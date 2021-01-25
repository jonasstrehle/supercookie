function _readOnlyError(name) {
  throw new TypeError("\"" + name + "\" is read-only");
}

module.exports = _readOnlyError;