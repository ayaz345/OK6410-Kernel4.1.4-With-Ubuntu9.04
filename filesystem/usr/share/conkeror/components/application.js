/**
 * (C) Copyright 2007 John J. Foerch
 * (C) Copyright 2007-2008 Jeremy Maitin-Shepard
 *
 * Use, modification, and distribution are subject to the terms specified in the
 * COPYING file.
**/

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function application () {
    Components.utils.import("resource://gre/modules/XPCOMUtils.jsm", this);

    this.wrappedJSObject = this;
    this.conkeror = this;

    this.loaded_modules = [];
    this.loading_modules = [];
    this.module_after_load_functions = new Object();
    this.pending_loads = [];

    try {
        this.require("conkeror.js");
    } catch (e) {
        this.dumpln("Error initializing.");
        this.dump_error(e);
    }
}
application.prototype = {
    Cc: Cc,
    Ci: Ci,
    Cr: Cr,
    /* Note: resource://app currently doesn't result in xpcnativewrappers=yes */
    module_uri_prefix: "chrome://conkeror-modules/content/",
    subscript_loader: Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader),
    preferences: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService),
    dump_error: function (e) {
        if (e instanceof Error) {
            this.dumpln(e.name + ": " + e.message);
            this.dumpln(e.fileName + ":" + e.lineNumber);
            dump(e.stack);
        } else if (e instanceof Ci.nsIException) {
            this.dumpln(e.name + ": " + e.message);
            var stack_frame = e.location;
            while (stack_frame) {
                this.dumpln(stack_frame.name + "()@" + stack_frame.filename + ":" + stack_frame.lineNumber);
                stack_frame = stack_frame.caller;
            }
        } else {
            this.dumpln("Error: " + e);
        }
    },
    loaded: function (module) {
        return (this.loaded_modules.indexOf(module) != -1);
    },
    provide: function(module) {
        if (this.loaded_modules.indexOf(module) == -1)
            this.loaded_modules.push(module);
    },
    skip_module_load : {},
    load_module: function(module_name) {
        if (this.loading_modules.indexOf(module_name) != -1)
            throw new Error("Circular module dependency detected: "
                            + this.loading_modules.join(" -> ") + " -> " + module_name);
        this.loading_modules.push(module_name);
        try {
            this.subscript_loader.loadSubScript(this.module_uri_prefix + module_name,
                                                this);
            this.provide(module_name);
            var funcs;
            if ((funcs = this.module_after_load_functions[module_name]) != null)
            {
                for (var i = 0; i < funcs.length; ++i)
                    funcs[i]();
                delete this.module_after_load_functions[module_name];
            }
        }
        catch (e if e == this.skip_module_load) {}
        catch (e) {
            if (!(e instanceof Error) && !(e instanceof Ci.nsIException) &&
                (String(e) == "ContentLength not available (not a local URL?)" ||
                 String(e) == "Error creating channel (invalid URL scheme?)"))
                throw new Error("Module not found: " + this.module_uri_prefix + module_name + ": " + e);
            throw e;
        }
        finally {
            this.loading_modules.pop();
        }

        if (this.loading_modules.length == 0)
        {
            while (this.pending_loads.length > 0)
            {
                this.require(this.pending_loads.pop());
            }
        }
    },
    require: function (module) {
        if (!this.loaded(module))
            this.load_module(module);
    },
    require_later: function (module) {
        if (!this.loaded(module)
            && this.pending_loads.indexOf(module) == -1)
            this.pending_loads.push(module);
    },
    call_after_load: function (module, func) {
        if (this.loaded(module))
            func();
        else
        {
            var funcs;
            if (!(funcs = this.module_after_load_functions[module]))
                funcs = this.module_after_load_functions[module] = [];
            funcs.push(func);
        }
    },
    dumpln: function (line) {
        dump(line + "\n");
    },

    version: "0.9 (commit 6944096a1af033d0aa70d8b4cc19b271e0d832b1, Debian-0.9~git080629-2)", // preprocessor variable
    homepage: "chrome://conkeror/content/help.html",

    /* nsISupports */
    QueryInterface: XPCOMUtils.generateQI([]),

    /* XPCOM registration */
    classDescription: "Conkeror global object",
    classID: Components.ID("{72a7eea7-a894-47ec-93a9-a7bc172cf1ac}"),
    contractID: "@conkeror.mozdev.org/application;1"
};

function NSGetModule(compMgr, fileSpec)
    XPCOMUtils.generateModule([application]);
