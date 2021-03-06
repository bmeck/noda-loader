var fs = require('fs');
var Module = require('module');
var vm = require('vm');
var debug = function () {};
var path = require('path');
var createModuleSystem = require('module-system').createModuleSystem;
var createNodaResourceSystem = require('./noda-resource-system').createNodaResourceSystem;
var has = require('has');
var zip = require('./zip.js'); 

var absolute = function (path) { return normalize(path) == path };
var join = path.join;
var normalize = path.normalize;
var extname = path.extname;
var dirname = path.dirname;

function _load(module, main) {
  module.require.main = main;
  module.load();
  module.loaded = true;
  return module.exports;
}

var nodaExtension = require('module')._extensions['.noda'] = function (module, filename) {
  var modSys = exports.createNodaModuleSystem(filename, filename);
  var ret = process.mainModule == module ? modSys.runMain('./') : modSys.run('./');
  module.exports = ret;
}

exports.createNodaModuleSystem = function createNodaModuleSystem(archive_path, handle_or_path, builtin_overrides) {
   var archive = zip.openSync(handle_or_path);
   var directory = archive.mapEntriesSync();
   var prefix = null;
   // assume prefixed
   var hasPrefix = true;
   directory = Object.keys(directory).reduce(function (dir, k) {
     var key = k.replace(/[\/\\]/g, '/').replace(/^\//, '');
     var _prefix = key.match(/[^\/]*/);
     if (hasPrefix) {
       if (prefix === null) {
         prefix = _prefix[0];
       }
       else if (prefix !== _prefix[0]) {
         hasPrefix = false; 
       }
     }
     dir[key] = directory[k];
     return dir;
   }, {});
   var realpath_cache = Object.create(null);
   var archiveResourceSystem = createNodaResourceSystem(archive_path, directory, prefix, hasPrefix);

   function in_archive(filepath) {
     if (filepath == null) return false;
     return filepath.indexOf(archive_path) === 0 && filepath[archive_path.length] === path.sep;
   }

   function to_archive_path(filepath) {
     debug('converting path to archive', filepath);
     return in_archive(filepath) ? (hasPrefix ? prefix + path.sep : '') + filepath.substring(archive_path.length + 1).replace(/[\/\\]/g, '/').replace(/^\//,'') : null;
   }

   function realpath(filepath) {
     if (!in_archive(filepath)) {
       throw new Error('Cannot realpath outside of archive');
     }
     return realpath_entry(to_archive_path(filepath)); // fs.realpathSync(filepath);
   }

   function fileExists(possibleFile, isAbsolute) {
     debug('checking exists? %s in_archive: %s is_absolute: %s', possibleFile, in_archive(possibleFile), isAbsolute)
     if (!in_archive(possibleFile)) {
       if (isAbsolute) {
         fs.statSync(possibleFile);
         return true;
       }
       debug('no');
       var e = new Error('ENOENT: ' + possibleFile);
       e.code = 'ENOENT';
       throw e;
     }
     else {
       var exists = has(directory, to_archive_path(possibleFile));
       debug('exists', exists);
       return exists;
     }
     return false;
   }
   
   function readSync(possibleFile) {
     var real = realpath(possibleFile)
     debug('reading sync %s -> %s', possibleFile, real);
     if (!in_archive(possibleFile)) {
       var e = new Error('ENOENT: ' + possibleFile);
       e.code = 'ENOENT';
       throw e;
     }
     return directory[real].entrySync().readFileSync();
   }

   function realpath_entry(filepath) {
     debug('realpathing entry %s', filepath);
     if (has(realpath_cache, filepath)) {
       return realpath_cache[filepath];
     }
     if (has(directory, filepath)) {
       var central_entry = directory[filepath];
       if (central_entry.isSymlink()) {
         var rel_path = central_entry.entrySync().readFileSync().toString(); 
         // if we are an absolute path bail since it is outside of the archive
         if (path.resolve(rel_path) === rel_path) {
           return null;
         }
         var next_path = path.normalize(path.join(path.dirname(filepath), rel_path));  
         var true_path = realpath_entry(next_path);
         debug('realpathed %s -> %s', filepath, true_path);
         realpath_cache[filepath] = true_path;
         return true_path;
       }
       debug('realpath %s unecessary', filepath);
       return filepath;
     }
     return null;
   }

   
   function resolve(module, modulePath) { 
     debug('resolving %s', modulePath);
     if (has(builtins, modulePath)) {
       debug('builtin');
       return modulePath;
     }
     var isFile = /^\.\.?\//.test(modulePath);
     var isAbsolute = path.resolve(modulePath) === modulePath;
     if (isAbsolute) isFile = true;
     var resolvedPath;
     var modDir = module == null ? '' : dirname(module.filename);
     var refPath;
     if (isFile) {
       refPath = path.resolve(archive_path, modDir, modulePath);
       resolvedPath = resolveFile(refPath, false, isAbsolute);
     }
     else {
       refPath = path.resolve(archive_path, modDir);
       resolvedPath = resolveNodeModule(modulePath, refPath); 
     }
     if (resolvedPath) {
       debug('found %s -> %s', modulePath, resolvedPath);
       if (isAbsolute || ( refPath === archive_path && in_archive(resolvedPath) ) || in_archive(refPath) === in_archive(resolvedPath)) {
         return resolvedPath;
       }
     }
     throw new Error('cound not find module '+JSON.stringify(modulePath));
   }
   
   function resolveFileExtension(possibleFile, isAbsolute) {
      var extension, stat, entry;
      debug('resolving extensions for %s', possibleFile);
      if (fileExists(possibleFile, isAbsolute)) {
        return possibleFile;
      }
      for (extension in extensions) {
         var withExtension = possibleFile + extension;
         if (fileExists(withExtension, isAbsolute)) {
           return withExtension;
         }
      }
      return null;
   }
   
   function resolveFile(possibleFile, skipExact, isAbsolute) {
     var stat;
     // EXACT
     if (!skipExact ) {
       var foundFile = resolveFileExtension(possibleFile, isAbsolute);
       if (foundFile) {
         return foundFile;
       }
     }
     var dir = possibleFile;
     var pkg;
     possibleFile = path.join(dir, 'package.json');
     try {
       debug('Finding package.json');
       if (fileExists(possibleFile)) {
         pkg = JSON.parse(readSync(possibleFile).toString());
         // PACKAGE.MAIN?
         debug('Finding package.json#main');
         if (pkg.main) {
           possibleFile = path.normalize(path.join(dir, pkg.main));
           foundFile = resolveFileExtension(possibleFile);
           debug('Resolved %s found: %s', possibleFile, foundFile);
           if (foundFile) {
             return foundFile;
           }
           // PACKAGE.MAIN INDEX?
           possibleFile = path.join(possibleFile, 'index');
         }
         else {
            // PACKAGE INDEX?
            possibleFile = path.normalize(path.join(dir, 'index'));
         }
         foundFile = resolveFileExtension(possibleFile);
         debug('Resolved %s found: %s', possibleFile, foundFile);
         if (foundFile) {
           return foundFile;
         }
       }
     }
     catch (e) {
       if (e.code !== 'ENOENT') throw e;
     }
     // INDEX?
     possibleFile = path.join(dir, 'index');
     foundFile = resolveFileExtension(possibleFile);
     debug('Resolved %s found: %s', possibleFile, foundFile);
     if (foundFile) {
       return foundFile;
     }
     if (skipExact && pkg) {
       var err = new Error('package does not contain a main');
       err.code = 'ENOENT';
       throw err;
     }
     return null;
   }
   
   function resolveNodeModule(name, modulesFolder) {
      var olddir, stat;
      do {
         if (path.dirname(modulesFolder) != 'node_modules') {
           var possiblePackage = path.join(modulesFolder, 'node_modules');
           try {
             var modulePath = resolveFile(path.join(modulesFolder, 'node_modules', name));
             if (modulePath) return modulePath;
           }
           catch (e) {
              if (e.code !== 'ENOENT') throw e;
           }
         }
         olddir = modulesFolder;
         modulesFolder = path.dirname(modulesFolder);
      } while (modulesFolder !== olddir);
      return null;
   }
   
   function cached(module, modulePath) {
      if (has(builtins, modulePath)) {
         debug('cached', modulePath);
         return builtins[modulePath];
      }
      if (has(cache, modulePath)) {
         debug('cached', modulePath);
         return cache[modulePath];
      }
      var resolvedPath = resolve(module, modulePath);
      return builtins[resolvedPath] || cache[resolvedPath] || null;
   }

   function load(module, resolvedPath) {
     debug('loaded', resolvedPath);
     var extension = extname(resolvedPath);
     var handler = extensions[extension] || extensions['.js'];
     module.require.extensions = extensions;
     module.require.cache = cache;
     module.require.resourceExistsSync = function (target) {
       var isAbsolute = path.resolve(target) == target;
       if (isAbsolute) {
         if (in_archive(target)) {
           return archiveResourceSystem.resourceExistsSync(target);
         }
         else {
           throw new Error('cannot access outside of archive');
         }
       }
       else {
         var resolvedTarget = path.resolve(dirname(resolvedPath), target);
         if (!in_archive(resolvedTarget)) {
           throw new Error('cannot access relative resource outside of archive');
         }
         else {
           return archiveResourceSystem.resourceExistsSync(resolvedTarget);
         }
       }
     }
     module.require.listResourcesSync = function (target) {
       var isAbsolute = path.resolve(target) == target;
       if (isAbsolute) {
         if (in_archive(target)) {
           return archiveResourceSystem.listResourcesSync(target);
         }
         else {
           throw new Error('cannot access outside of archive');
         }
       }
       else {
         var resolvedTarget = path.resolve(dirname(resolvedPath), target);
         if (!in_archive(resolvedTarget)) {
           throw new Error('cannot access relative resource outside of archive');
         }
         else {
           return archiveResourceSystem.listResourcesSync(resolvedTarget);
         }
       }
     }
     module.require.resourceExists = function (target, cb) {
       var isAbsolute = path.resolve(target) == target;
       if (isAbsolute) {
         if (in_archive(target)) {
            archiveResourceSystem.resourceExists(target, cb);
         }
         else {
           cb(new Error('cannot access outside of archive'), null);
         }
       }
       else {
         var resolvedTarget = path.resolve(dirname(resolvedPath), target);
         if (!in_archive(resolvedTarget)) {
           cb(new Error('cannot access relative resource outside of archive'), null);
         }
         else {
           archiveResourceSystem.resourceExists(resolvedTarget, cb);
         }
       }
     }
     module.require.listResources = function (target, cb) {
       var isAbsolute = path.resolve(target) == target;
       if (isAbsolute) {
         if (in_archive(target)) {
            archiveResourceSystem.listResources(target, cb);
         }
         else {
           cb(new Error('cannot access outside of archive'), null);
         }
       }
       else {
         var resolvedTarget = path.resolve(dirname(resolvedPath), target);
         if (!in_archive(resolvedTarget)) {
           cb(new Error('cannot access relative resource outside of archive'), null);
         }
         else {
           archiveResourceSystem.listResources(resolvedTarget, cb);
         }
       }
     }
     module.require.readResourceSync = function (target, opts) {
       var resolvedTarget = path.resolve(dirname(resolvedPath), target);
       return archiveResourceSystem.readResourceSync(resolvedTarget, opts);
     }
     module.require.readResource = function (target, opts, cb) {
       var resolvedTarget = path.resolve(dirname(resolvedPath), target);
       archiveResourceSystem.readResource(resolvedTarget, opts, cb);
     }
     module.require.createReadStream = function (target, opts) {
       var resolvedTarget = path.resolve(dirname(resolvedPath), target);
       return archiveResourceSystem.createReadStream(resolvedTarget, opts);
     }
     module.require.main = process.mainModule;
     cache[resolvedPath] = module;
     handler(module, resolvedPath);
     return module;
   }

   var builtins = {};
   for (var k in process.binding('natives')) {
     builtins[k] = {exports:require(k),children:[]};
   }

   if (builtin_overrides && typeof builtin_overrides === 'object') {
     for (var k in builtin_overrides) {
       builtins[k] = {exports: builtin_overrides[k], children: []};
     }
   }
   var cache = Object.create(null);
   
   var extensions = {
     '.js': function (module, filename) {
       var buffer = readSync(filename).toString().replace(/^#!.*/, '');
       //debug('loading', buffer.toString());
       var fn = new Function('__filename', '__dirname', 'require', 'module', 'exports', buffer);
       var script = vm.createScript('('+fn+')', filename);
       script.runInThisContext()(filename, dirname(filename), module.require, module, module.exports);
     },
     '.json': function (module, filename) {
       var buffer = readSync(filename);
       module.exports = JSON.parse(buffer.toString());
     },
     '.noda': nodaExtension,
     '.node': function (module, filename) {
       if (in_archive(filename)) {
         var tmpdir = process.platform === 'win32' ? process.env.TMP || process.cwd() : process.env.TMPDIR || '/var/tmp'; 
         var dldir;
         var tmpfile;
         var rmdir = false;
         var unlink = false;
         var content = module.require.readResourceSync(filename);
         tmpdir = tmpdir+''; 
         for (var i = 0; ; i++) {
           dldir = path.join(tmpdir, i+'');
           try {
             fs.mkdirSync(dldir);
             rmdir = true;
             fs.writeFileSync(tmpfile = path.join(dldir, path.basename(filename)), content, {flag: 'wx'});
             debug('made file');
             unlink = true;
             process.dlopen(module, tmpfile);
             fs.unlinkSync(tmpfile);
             fs.rmdirSync(dldir);
             break;
           }
           catch (e) {
             debug('unable to create tmp file for native module', e);
             if (unlink) fs.unlinkSync(tmpfile);
             if (rmdir) fs.rmdirSync(dldir);
             if (i > 1000) {
               throw new Error('Unable to create temporary file');
             }
           }
           i++;
         }
       }
       else {
         return process.dlopen.apply(this, arguments);
       }
     }
   };
   
   var ModuleSystem = createModuleSystem(cached, resolve, load);
   builtins.module = {
     exports: ModuleSystem,
     children: []
   };
   ModuleSystem._extensions = extensions;
   ModuleSystem.Module = ModuleSystem;
   ModuleSystem.wrap = Module.wrap;
   ModuleSystem.run = function (_path) {
     var resolvedPath = resolveFile(path.join(archive_path, _path), true);
     debug('.noda main found as %s', resolvedPath);
     var module = new ModuleSystem(resolvedPath, null);
     module.parent = null;
     if (!process.mainModule) process.mainModule = module;
     return _load(module, module);
   } 
   ModuleSystem._resolveFilename = function (request, parent) {
     return resolve(parent, request);
   }
   ModuleSystem._nodeModulePaths = Module._nodeModulePaths; 
   ModuleSystem.runMain = function (_path) {
     var resolvedPath = resolveFile(path.join(archive_path, _path), true);
     debug('.noda main found as %s', resolvedPath);
     var module = new ModuleSystem(resolvedPath, null);
     module.parent = null;
     process.mainModule = module;
     return _load(module, module);
   } 
   return ModuleSystem;
}
