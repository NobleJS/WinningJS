﻿"use strict";

exports.s = function (key) {
    if (!key || typeof key !== "string") {
        throw new Error("Resource key must be a valid string");
    }
    return WinJS.Resources.getString(key).value;
};

exports.augmentGetString = function () {
    var REFERENCE_REGEX = /\{\^([^{]+)\}/g;
    var oldWinjsGetString = WinJS.Resources.getString;
    
    function getWithReferenceReplaced(string) {
        REFERENCE_REGEX.lastIndex = 0; // http://blog.stevenlevithan.com/archives/es3-regexes-broken
        
        return string.replace(REFERENCE_REGEX, function (bracedKey, key) {
            var resource = WinJS.Resources.getString(key);

            return resource.value;
        });
    }
    
    WinJS.Resources.getString = function (id) {
        var object = oldWinjsGetString(id);
        
        object.value = getWithReferenceReplaced(object.value);

        return object;
    };

};