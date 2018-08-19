(function () {
  // enhance toFixed
  if (!Number.prototype._toFixed) {
    Number.prototype._toFixed = Number.prototype.toFixed;
  }
  Number.prototype.toFixed = function (n) {
    return (this + 3e-16)._toFixed(n);
  };

  // add deduplicate
  Array.prototype.deduplicate = function (without = []) {
    let array = [];
    this.forEach(o => {
      if (without.indexOf(o) === -1 && array.indexOf(o) === -1) array.push(o);
    });
    return array;
  }

  String.prototype.format = function () {
    let params = arguments;
    return this.replace(/{\d+}/g, function (match) {
      let index = Number(match.replace("{", "").replace("}", ""));
      let replacement = params[index];
      if (typeof replacement === "undefined" || replacement === null) {
        replacement = "";
      }
      return replacement;
    })
  }
})();
