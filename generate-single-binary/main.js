require('../');
/**
 * All the code below is from node/lib/module.js except for very minor tweaks
 */
function evalScript(name) {
 var Module = _require('module');
 var path = _require('path');
 var cwd = process.cwd();

 var module = new Module(name);
 module.filename = path.join(cwd, name);
 module.paths = Module._nodeModulePaths(cwd);
 var script = process._eval;
 if (!Module._contextLoad) {
   var body = script;
   script = 'global.__filename = ' + JSON.stringify(name) + ';\n' +
            'global.exports = exports;\n' +
            'global.module = module;\n' +
            'global.__dirname = __dirname;\n' +
            'global.require = require;\n' +
            'return require("vm").runInThisContext(' +
            JSON.stringify(body) + ', { filename: ' +
            JSON.stringify(name) + ' });\n';
 }
 var result = module._compile(script, name + '-wrapper');
 if (process._print_eval) console.log(result);
}
var loaded_as_zip = false;
try {
  require('../lib/zip.js').openSync(process.execPath)
  var mod = new (_require('module'))(process.execPath, null);
  mod.parent = null;
  process.mainModule = mod;
  process.argv.splice(2, 0, process.execPath);
  loaded_as_zip = true;
  require('module')._extensions['.noda'](mod, process.execPath);
}
catch (e) {
 // something happened during loading the .noda, bail
 if (loaded_as_zip) throw e;
 if (process.argv[1] == 'debug') {
   // Start the debugger agent
   var d = _require('_debugger');
   d.start();

 } else if (process._eval != null) {
   // User passed '-e' or '--eval' arguments to Node.
   evalScript('[eval]');
 } else if (process.argv[1]) {
   // make process.argv[1] into a full path
   var path = _require('path');
   process.argv[1] = path.resolve(process.argv[1]);

   // If this is a worker in cluster mode, start up the communication
   // channel.
   if (process.env.NODE_UNIQUE_ID) {
     var cluster = _require('cluster');
     cluster._setupWorker();

     // Make sure it's not accidentally inherited by child processes.
     delete process.env.NODE_UNIQUE_ID;
   }

   var Module = _require('module');

   if (global.v8debug &&
       process.execArgv.some(function(arg) {
         return arg.match(/^--debug-brk(=[0-9]*)?$/);
       })) {

     // XXX Fix this terrible hack!
     //
     // Give the client program a few ticks to connect.
     // Otherwise, there's a race condition where `node debug foo.js`
     // will not be able to connect in time to catch the first
     // breakpoint message on line 1.
     //
     // A better fix would be to somehow get a message from the
     // global.v8debug object about a connection, and runMain when
     // that occurs.  --isaacs

     var debugTimeout = +process.env.NODE_DEBUG_TIMEOUT || 50;
     setTimeout(Module.runMain, debugTimeout);

   } else {
     // Main entry point into most programs:
     _require('module').runMain();
   }

 } else {
   var Module = _require('module');

   // If -i or --interactive were passed, or stdin is a TTY.
   if (process._forceRepl || _require('tty').isatty(0)) {
     // REPL
     var opts = {
       useGlobal: true,
       ignoreUndefined: false
     };
     if (parseInt(process.env['NODE_NO_READLINE'], 10)) {
       opts.terminal = false;
     }
     if (parseInt(process.env['NODE_DISABLE_COLORS'], 10)) {
       opts.useColors = false;
     }
     var repl = Module.requireRepl().start(opts);
     repl.on('exit', function() {
       process.exit();
     });

   } else {
     // Read all of stdin - execute it.
     process.stdin.setEncoding('utf8');

     var code = '';
     process.stdin.on('data', function(d) {
       code += d;
     });

     process.stdin.on('end', function() {
       process._eval = code;
       evalScript('[stdin]');
     });
    }
  }
}
