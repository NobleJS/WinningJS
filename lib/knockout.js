"use strict";

/*global MSGesture: false */

var collectionChange = Windows.Foundation.Collections.CollectionChange;
var $ = require("jquery2");
var ko = require("knockout");
var s = require("./resources").s;

exports.observableArrayFromVector = function (vector, mapping) {
    // Don't let `Array.prototype.map` pass through index and array arguments. If that happened, then e.g. removing
    // an element from the array would mean needing to re-map all elements after it, since their indices changed.
    // We don't want to support that use case, so ensure that at all times `mapping` gets only a single argument.
    var singleArgMapping = mapping ? function (x) { return mapping(x); } : function (x) { return x; };

    var array = ko.observableArray(vector.map(singleArgMapping));

    vector.addEventListener("vectorchanged", function (ev) {
        switch (ev.collectionChange) {
        case collectionChange.reset:
            array.removeAll();
            array.push.apply(array, vector.map(singleArgMapping));
            break;
        case collectionChange.itemInserted:
            array.splice(ev.index, 0, singleArgMapping(vector[ev.index]));
            break;
        case collectionChange.itemRemoved:
            array.splice(ev.index, 1);
            break;
        case collectionChange.itemChanged:
            array.splice(ev.index, 1, singleArgMapping(vector[ev.index]));
            break;
        }
    });

    return array;
};

exports.observableFromMapItem = function (map, itemKey) {
    var observable = ko.observable(map[itemKey]);

    map.addEventListener("mapchanged", function (ev) {
        if (ev.key === itemKey && ev.collectionChange === collectionChange.itemChanged) {
            observable(map[itemKey]);
        }
    });

    return observable;
};

exports.twoWayObservableFromMapItem = function (map, itemKey) {
    var observable = exports.observableFromMapItem(map, itemKey);

    observable.subscribe(function (newValue) {
        if (map[itemKey] !== newValue) {
            map[itemKey] = newValue;
        }
    });

    return observable;
};

exports.addBindings = function () {
    // TODO: generalize to any winControl event.
    ko.bindingHandlers.itemInvoked = {
        init: function (element, valueAccessor) {
            var winControl = element.winControl;
            if (!winControl) {
                throw new Error("Cannot listen to itemInvoked on an element that does not own a winControl.");
            }

            var handler = valueAccessor();

            winControl.addEventListener("iteminvoked", function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(winControl);
                handler.apply(this, args);
            });
        }
    };

    ko.bindingHandlers.variableClass = {
        update: function (element, valueAccessor) {
            var className = ko.utils.unwrapObservable(valueAccessor());
            var $element = $(element);

            var previousClass = $element.data("ko-variable-class");
            if (previousClass) {
                $element.removeClass(previousClass);
            }

            if (className) {
                $element.data("ko-variable-class", className);
                $element.addClass(className);
            }
        }
    };

    ko.bindingHandlers.winControlLabelKey = {
        update: function (element, valueAccessor) {
            var label = ko.utils.unwrapObservable(valueAccessor());

            if (element.winControl) {
                var labelElement = element.querySelector(".win-label");
                if (labelElement) {
                    var labelText = s(label);
                    labelElement.textContent = labelText;
                }
            } else {
                if (element.hasAttribute("data-win-res")) {
                    throw new Error("Can not use both `winControlLabel` ko binding handler and `data-win-res` attribute");
                }

                element.setAttribute("data-win-res", "{ winControl: { label: '" + label + "' } }");
            }
        }
    };

    ko.bindingHandlers.gesture = {
        init: function (element, valueAccessor) {
            var gesture = new MSGesture();
            var options = valueAccessor();
            var events = Object.keys(options);

            if (!events.hasOwnProperty("MSPointerDown")) {
                element.addEventListener("MSPointerDown", function (evt) {
                    gesture.target = gesture.target || element;
                    gesture.addPointer(evt.pointerId);
                }, false);
            }

            events.forEach(function (eventName) {
                element.addEventListener(eventName, function (evt) {
                    if (eventName === "MSPointerDown" && gesture.target === null) {
                        gesture.target = element;
                    }
                    return options[eventName](evt, gesture);
                }, false);
            });
        }
    };

    ko.bindingHandlers.component = {
        init: function () {
            return { controlsDescendantBindings: true };
        },
        update: function (placeholderEl, valueAccessor) {
            var component = ko.utils.unwrapObservable(valueAccessor());

            var componentEl = component.render();
            ko.virtualElements.setDomNodeChildren(placeholderEl, [componentEl]);
            component.process().done();
        }
    };
    ko.virtualElements.allowedBindings.component = true;

    var VOREACH_KEY = "__ko_voreach_vectorObservableArray";

    function createVoreachValueAccessor(element) {
        return function () {
            return element[VOREACH_KEY];
        };
    }

    ko.bindingHandlers.voreach = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            var winRTObservableVector = ko.utils.unwrapObservable(valueAccessor());
            element[VOREACH_KEY] = ko.observableArray(winRTObservableVector);

            winRTObservableVector.addEventListener("vectorchanged", function () {
                element[VOREACH_KEY].valueHasMutated();
            });

            return ko.bindingHandlers.foreach.init(
                element, createVoreachValueAccessor(element), allBindingsAccessor, viewModel, bindingContext
            );
        },
        update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
            return ko.bindingHandlers.foreach.update(
                element, createVoreachValueAccessor(element), allBindingsAccessor, viewModel, bindingContext
            );
        }
    };
    ko.virtualElements.allowedBindings.voreach = true;

    function createWinrtValueAccessor(key, newValue) {
        var obj = {};
        obj[key] = newValue;
        return function () {
            return obj;
        };
    }

    function updateWinrtBinding(element, bindingName, key, newValue) {
        var newValueAccessor = createWinrtValueAccessor(key, newValue);
        ko.bindingHandlers[bindingName].update(element, newValueAccessor);
    }

    ko.bindingHandlers.winrt = {
        init: function (element, valueAccessor, allBindingsAccessor, viewModel) {
            var bindings = valueAccessor();

            // a map from view model property names to { bindingName, key } arrays
            var bindingsMap = Object.create(null);

            Object.keys(bindings).forEach(function (bindingName) {
                switch (bindingName) {
                case "attr":
                case "style": // these two both take object literals mapping to property names.
                    var map = bindings[bindingName];
                    Object.keys(map).forEach(function (key) {
                        var propertyName = map[key];

                        if (!(propertyName in bindingsMap)) {
                            bindingsMap[propertyName] = [];
                        }

                        bindingsMap[propertyName].push({ bindingName: bindingName, key: key });
                        updateWinrtBinding(element, bindingName, key, viewModel[propertyName]);
                    });

                    break;
                default:
                    throw new Error("I can't deal with this.");
                }

                viewModel.addEventListener("mapchanged", function (ev) {
                    var propertyName = ev.key;
                    if (ev.collectionChange === collectionChange.itemChanged && propertyName in bindingsMap) {
                        bindingsMap[propertyName].forEach(function (binding) {
                            updateWinrtBinding(element, binding.bindingName, binding.key, viewModel[propertyName]);
                        });
                    }
                });
            });
        }
    };
};
