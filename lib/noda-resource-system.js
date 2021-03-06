var path = require('path');
var has = require('has');
var debug = function () {};
var Readable = require('stream').Readable;
var absolute = function (path) { return normalize(path) == path };
var join = path.join;
var normalize = path.normalize;
var extname = path.extname;
var dirname = path.dirname;
exports.createNodaResourceSystem = function createNodaResourceSystem(archive_path, archive_directory, prefix, hasPrefix) {
  function in_archive(filepath) {
    return filepath.indexOf(archive_path) === 0 && filepath[archive_path.length] === path.sep;
  }

  function to_archive_path(filepath) {
    debug('finding resource %s', filepath);
    return in_archive(filepath) ? (hasPrefix ? prefix + path.sep : '') + filepath.substring(archive_path.length + 1).replace(/[\/\\]/g, '/').replace(/^\//,'') : null;
  }
  return {
    resourceExists: function resourceExists(target, cb) {
      setImmediate(function () {
         cb(resourceExistsSync(target));
      });
    },
    resourceExistsSync: function resourceExistsSync(target) {
      var archive_target = to_archive_path(target);
      return has(archive_directory, archive_target);
    },
    listResourcesSync: function listResources(dir, cb) {
      // absolute paths are not allowed
      var archive_target = to_archive_path(dir);
      if (archive_target == null) {
        throw new Error('could not find resource');
      } 
      else {
        if (archive_target.slice(-1) == '/') archive_target = archive_target.slice(0, -1);
        var entries = Object.keys(archive_directory).filter(function (entry_path) {
          return path.dirname(entry_path) === archive_target;
        }).map(path.basename);
        if (entries.length === 0 && !(archive_directory[archive_target] && archive_directory[archive_target].isDirectory())) {
          throw new Error('could not find resource');
        }
        return entries;
      }
    },
    listResources: function listResources(dir, cb) {
      var ret;
      try {
        ret = this.listResourcesSync(dir);
      }
      catch (e) {
        setImmediate(function () {
          cb(e, null);
        });
        return;
      }
      setImmediate(function () {
        cb(null, ret);
      });
    },
    readResource: function readResource(target, opts, cb) {
      if (typeof opts === 'function') {
        cb = opts;
        opts = null;
      }
      var content;
      try {
        content = this.readResourceSync(target, opts);
      }
      catch (e) {
        setImmediate(function () {
          cb(e, null);
        });
        return;
      }
      setImmediate(function () {
        cb(null, content);
      });
    },
    readResourceSync: function (target, opts) {
      var archive_target = to_archive_path(target);
      if (!archive_target || !has(archive_directory, archive_target)) {
        var err = new Error('ENOENT: ' + target);
        err.code = 'ENOENT';
        throw err;
      }
      else {
        var buff = archive_directory[archive_target].entrySync().readFileSync(opts);
        if (opts) {
          return buff.toString(opts);
        }
        else {
          return buff;
        }
      }
    },
    createReadStream: function (target, opts) {
      var content = this.readResourceSync(target, opts);
      var stream = new Readable();
      var index = 0;
      stream._read = function (n) {
        if (index === content.length) {
          return null;
        }
        var end = Math.min(index+n, content.length);
        index = end;
        return content.slice(index, end);
      };
      stream.push(content);
      return stream;
    }
  }
}
