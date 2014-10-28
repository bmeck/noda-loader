
de Archive Specification

The Node Archive Specification defines a format and semantics for loading multiple files in [Node.js](//nodejs.org) via a single archive file. These files will be kept in memory only when possible. 

**Note:** Most OSs are unable to load a shared library via memory, this means temporary files will be used.

## File extension

The `.noda` extension is used in order to prevent colisions and represents `NOD`e `A`rchive.

## File format

The `.noda` file format is a standard `.zip` archive with some special expectations.

1. The archive is not separated into multiple parts
2. The archive is structured in the same manner as a `npm` module
   1. If a prefix is found to be on all files in an archive it will be optional when using the archive.

The choice of the Zip file format relies on several aspects, but having a central directory and the directory being located at the end of the file are the main reasons.

## File Semantics

There are certain semantics that need to be discussed due to using in memory files as well as encapsulation.

1. Files within an archive cannot use **relative** paths to require a resource outside of the archive. To do so, turn the path into an absolute one.
2. Files within an archive cannot be accessed using the `fs` module. See [Resources](#resources).
3. Archives cannot be required if nested in another archive.

## Modified `require` semantics

Some features of the archive loader modify how `require` works internally.

1. Files within an archive cannot be required directly (e.g. `require('./test.noda/internal.js')` is not possible).
2. Archives cannot be accessed without file extension.

## Resources

While working with in-memory files such as those loaded via archives, problems arrise from not having real OS level files. In order to abstract from this, a concept called "Resources" is used.

The term "Resource" will describe any data that is not configured on a per-run basis for applications. Generally, resources will be read only. They provide a way to access assets without needing to know if a file was loaded inside an archive. Many use cases are valid resources, but common examples include:

* Pre-built templates
* Pre-built images
* Files used by libraries without dynamic paths

### String[] require.listResources(targetPath)

This function signature matches `fs.readdir` but works in archives as well.

### void require.readResource(targetPath[, String encoding], callback(Error?, Buffer|String))

This function signature matches `fs.readFile` but works in archives as well.

### ReadableStream require.createReadStream(targetPath)

This function signature matches `fs.createReadStream` but works in archives as well.

## Examples

Consider the following directory structure.

```
C:\
  my_app\
    node_modules\
      express\
    logging.noda\
      index.js
    logic.noda\
      node_modules\
        async\
      package.json -> main:server.js
      routes.js -> require(async)
      server.js -> require(routes.js, express)
      bad.noda
    main.js -> require(logging.noda, logic.noda)
```

### Index detection in an archive

```
C:\my_app\main.js require("./logging.noda") -> C:\my_app\logic.noda\index.js
```

### Package detection in an archive

```
C:\my_app\main.js require("./logic.noda") -> C:\my_app\logic.noda\package.json -> C:\my_app\logic.noda\server.js
```

### Internal modules in an archive

```
C:\my_app\logic.noda\server.js require("async") -> C:\my_app\logic.noda\node_modues\async\
C:\my_app\logic.noda\server.js require("./routes.js") -> C:\my_app\logic.noda\routes.js
```

### Shared (external) modules outside an archive

```
C:\my_app\logic.noda\server.js require("express") -> C:\my_app\node_modues\express\
```

### Absolute modules outside an archive

```
C:\my_app\logic.noda\server.js require("C:\\my_app\\main.js") -> C:\my_app\main.js
```

### Using a resource

```
C:\my_app\logic.noda\server.js require.readResourceSync("./package.json") -> C:\my_app\logic.noda\package.json's content
```

### Errors

#### Modules cannot escape archive

```
C:\my_app\logic.noda\server.js require("../main.js") throws
```

#### Archives are not allowed to be nested

```
C:\my_app\logic.noda\server.js require("./bad.noda") throws
```

#### Filesystem breaking

See [Resources](#resources)

```
C:\my_app\logic.noda\server.js require("fs").readFileSync("./package.json") throws
```

