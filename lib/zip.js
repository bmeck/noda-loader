var path = require('path');
var pako = require('pako');

var MAX_COMMENT_SIZE = 65535;
var CENTRAL_DIRECTORY_HEADER_SIZE = 22;
var PREF_BUFFER_SIZE = 4096;

//
// used to make sub-sections of a file
//
function fdUtilSync(fd, start, stop) {
  if (typeof start === 'number' && typeof stop !== 'number') {
    throw new Error('if you provide a start, you must provide a stop');
  }
  //this.start = start;
  //this.stop = stop;
  this.fstatSync = function () {
    var result = require('fs').fstatSync(fd);
    if (start === start && stop === stop) {
      result.size = stop - start;
    }
    return result;
  };
  start = +start;
  stop = +stop;
  // NaN checks
  if (start !== start) {
    start = 0;
  }
  if (stop !== stop) {
    stop = this.fstatSync().size;
  }
  this.fd = fd;
  this.start = start;
  this.stop = stop;
  this.close = function () {
    require('fs').close(fd);
  }
  this.readSync = function (buff, buff_offset, amount, file_offset) {
    file_offset += start;
    if (file_offset + amount > stop) {
      var err = new Error('EINVAL');
      throw err;
    }
    var read = 0;
    while (read < amount) {
      read += require('fs').readSync(fd, buff, buff_offset, amount, file_offset);
    }
    return read;
  };
  this.sub = function (substart, substop) {
    var offset = start || 0;
    return new fdUtilSync(fd, offset + substart, offset + substop);
  };
  this.readStreamSync = function (ondata) {
    var needle = start;
    while (needle < stop) {
      var read_len = stop - needle;
      if (read_len > PREF_BUFFER_SIZE) {
        read_len = PREF_BUFFER_SIZE;
      }
      if (needle + read_len > stop) {
        read_len = stop - needle;
      }
      var buff = new Buffer(read_len);
      var bytes_read = require('fs').readSync(fd, buff, 0, buff.length, needle);
      if (ondata) ondata(buff.slice(0, bytes_read));
      needle += bytes_read;
    }
  };
  return this;
}

function Zip(file, header) {
  this.file = file;
  this.header = header;
  return this;
}
module.exports = Zip;
Object.defineProperties(Zip.prototype, {
  centralDirectoryEntries: {
    get: function () {
      return this.header.readUInt16LE(10);
    }
  },
  centralDirectoryLength: {
    get: function () {
      return this.header.readUInt32LE(12);
    }
  },
  centralDirectoryOffset: {
    get: function () {
      return this.header.readUInt32LE(16);
    }
  },
  length: {
    get: function () {
      return this.centralDirectoryLength + this.centralDirectoryOffset + this.header.length;
    }
  }
});
Zip.openSync = function (opts) {
  if (typeof opts === 'string') {
    var fd = require('fs').openSync(opts, 'r');
    return fopenZipSync(new fdUtilSync(fd));
  } 
  else if (opts.file instanceof fdUtilSync) {
    return fopenZipSync(opts.file, cb);
  }
  else if (typeof opts === 'object' && opts && typeof opts.fd === 'number') {
    return fopenZipSync(new fdUtilSync(opts.fd));
  }
  throw new Error('invalid arguments');
}
Zip.prototype.mapEntriesSync = function mapEntriesSync() {
  var results = Object.create(null);
  this.directoryStreamSync(function (directory_entry) {
    results[directory_entry.name] = directory_entry;
  });
  return results;
}

function fopenZipSync(file, cb) {
  var stat = file.fstatSync();
  var len = stat.size;
  var central_dir_position = 0;
  var found = 0;
  var buffers = [];
  while (true) {
    var read_len = CENTRAL_DIRECTORY_HEADER_SIZE + MAX_COMMENT_SIZE - central_dir_position;
    if (read_len > PREF_BUFFER_SIZE) {
      read_len = PREF_BUFFER_SIZE;
    }
    var read_pos = len - central_dir_position - read_len;
    if (read_pos < 0) {
      read_len += read_pos;
      read_pos = 0;
    }
    if (read_len <= 0) {
      file.close();
      throw new Error('not a zip');
    }
    var buff = new Buffer(read_len);
    var bytes_read = file.readSync(buff, 0, read_len, read_pos);
    for (var i = bytes_read; i-->0;) {
      if (found === 0 && buff[i] === 0x06) {found = 1;}
      else if (found === 1 && buff[i] === 0x05) {found = 2;}
      else if (found === 2 && buff[i] === 0x4b) {found = 3;}
      else if (found === 3 && buff[i] === 0x50) {
        found=4;
        break;
      }
      else {found = 0;}
    }
    central_dir_position += bytes_read-i-1;
    if (found === 4) {
      buffers.push(buff.slice(i));
      var zip =  new Zip(null, Buffer.concat(buffers));
      zip.file = file.sub(len - zip.length, len);
      return zip;
    }
    buffers.push(buff);
  }
}
Zip.prototype.directoryStreamSync = function (onEntry) {
  var file = this.file;
  var needle = this.centralDirectoryOffset;
  for (var count = this.centralDirectoryEntries; count-->0;) {
    var entry_header_buff = new Buffer(46);
    file.readSync(entry_header_buff, 0, 46, needle);
    needle += 46;
      
    var file_name_size = entry_header_buff.readUInt16LE(0x1c);
    var extra_field_size = entry_header_buff.readUInt16LE(0x1e);
    var comment_size = entry_header_buff.readUInt16LE(0x20);
    var variable_size = file_name_size + extra_field_size + comment_size;
    var buff = new Buffer(variable_size);
    file.readSync(buff, 0, variable_size, needle);
    needle += variable_size;
        
    var file_name_buff = new Buffer(file_name_size);
    buff.copy(file_name_buff, 0, 0, file_name_size);
    
    var extra_field_buff = new Buffer(extra_field_size);
    buff.copy(extra_field_buff, 0, file_name_size, file_name_size + extra_field_size);
    
    var comment_buff = new Buffer(comment_size);
    buff.copy(comment_buff, 0, file_name_size + extra_field_size, variable_size);
    
    var entry = new ZipDirectoryEntry(file, entry_header_buff, file_name_buff, extra_field_buff, comment_buff);
    if (onEntry) onEntry(entry);
  }
};

function ZipDirectoryEntry(file, header, entryName, extraField, comment) {
  this.file = file;
  this.header = header;
  this.name = entryName;
  this.extraField = extraField;
  this.comment = comment;
}
Object.defineProperties(ZipDirectoryEntry.prototype, {
  isSymlink: {
    value: function () {
      return this.externalData >>> 28 === 0xa;
    }
  },
  isDirectory: {
    value: function () {
      return this.externalData >>> 28 === 0x4;
    }
  },
  externalData: {
    get: function () {
      return this.header.readUInt32LE(0x26);
    }
  },
  localHeaderOffset: {
    get: function () {
      return this.header.readUInt32LE(42);
    }
  },
  compressedSize: {
    get: function () {
      return this.header.readUInt32LE(20);
    }
  },
  compressionMethod: {
    get: function () {
      return this.header.readUInt16LE(10);
    }
  }
});
ZipDirectoryEntry.prototype.entrySync = function () {
  var file = this.file;
  var localHeaderOffset = this.localHeaderOffset;
  var entry_header_buff = new Buffer(0x1e);
  file.readSync(entry_header_buff, 0, 0x1e, localHeaderOffset);
  
  var file_name_size = entry_header_buff.readUInt16LE(0x1a);
  var extra_field_size = entry_header_buff.readUInt16LE(0x1c);
  var variable_size = file_name_size + extra_field_size;
  var buff = new Buffer(variable_size);
  
  file.readSync(new Buffer(variable_size), 0, variable_size, localHeaderOffset + 0x2e);
  
  var file_name_buff = new Buffer(file_name_size);
  buff.copy(file_name_buff, 0, 0, file_name_size);
  
  var extra_field_buff = new Buffer(extra_field_size);
  buff.copy(extra_field_buff, 0, file_name_size, file_name_size + extra_field_size);
  
  var _entry = new ZipEntry(null, entry_header_buff, file_name_buff, extra_field_buff);
  // need to read compressedSize :(
  _entry.file = file.sub(localHeaderOffset, localHeaderOffset + 30 + variable_size + _entry.compressedSize);
  return _entry;
};

function ZipEntry(file, header, entryName, extraField) {
  this.file = file;
  this.header = header;
  this.name = entryName;
  this.extraField = extraField;
  return this;
}
Object.defineProperties(ZipEntry.prototype, {
  signature: {
    get: function () {
     return this.header.readUInt32LE(0);
    }
  },
  version: {
    get: function () {
     return this.header.readUInt16LE(4);
    }
  },
  flags: {
    get: function () {
     return this.header.readUInt16LE(6);
    }
  },
  compressionMethod: {
    get: function () {
      return this.header.readUInt16LE(8);
    }
  },
  mtime: {
    get: function () {
     return this.header.readUInt16LE(10);
    }
  },
  mdate: {
    get: function () {
     return this.header.readUInt16LE(12);
    }
  },
  checksum: {
    get: function () {
     return this.header.readUInt32LE(14);
    }
  },
  compressedSize: {
    get: function () {
      return this.header.readUInt32LE(18);
    }
  },
  uncompressedSize: {
    get: function () {
      return this.header.readUInt32LE(22);
    }
  },
  nameSize: {
    get: function () {
      return this.header.readUInt16LE(0x1a);
    }
  },
  extraFieldSize: {
    get: function () {
      return this.header.readUInt16LE(0x1c);
    }
  },
  headerSize: {
    get: function () {
      return this.header.length + this.nameSize + this.extraFieldSize;
    }
  },
  readFileSync: {
    value: function (options) {
      var buffers = [];
      var _ondata = function (buff) {
        buffers.push(buff);
      };
      var file = this.file.sub(this.headerSize, this.headerSize + this.compressedSize)
      file.readStreamSync(_ondata);
      if (this.compressionMethod === 8) {
        return new Buffer(new Uint8Array(pako.inflateRaw(Buffer.concat(buffers))))//, options)));
      }
      else if (this.compressionMethod === 0) {
        return Buffer.concat(buffers);
      }
      throw new Error('Unknown compression');
    }
  }
});

