module.exports = function (grunt) {
    var q               = require("q"),
        path            = require('path'),
        less            = require('less'),
        requirejs       = require('requirejs'),
        hogan           = require("hogan.js"),
        fs              = require("fs");

    grunt.registerTask("packaged-app", "Performs tasks necessary to run brackets as a packaged app", function () {
        
        var done = this.async(),
            mainJsName = "brackets-build.js",
            mainCssName = "brackets-less.css";

        var buildDir = path.join(process.cwd(), 'packaged-app-build');
        fs.mkdirSync(buildDir);
        fs.mkdirSync(path.join(buildDir, 'extensions'));
        fs.mkdirSync(path.join(buildDir, 'styles'));

        var configStr = fs.readFileSync('src/packagedApp/require-optimize-config.json', 'utf8');
        var requirejsConfig = JSON.parse(configStr);

        // create a single static brackets.js file from all of the source. 
        var optimizeMainJs = function(){
            var scriptOut = path.join(buildDir, mainJsName);
            requirejsConfig.out = scriptOut;
            requirejsConfig.baseUrl = path.join(process.cwd(), 'src');

            var deferred = q.defer();
            requirejs.optimize(requirejsConfig, function(resp){
                deferred.resolve();
            }, function(err){
                deffered.reject(err);
            });
            return deferred.promise;
        }


        var optimizeMainCss = function(){
            var lessSrc = fs.readFileSync('src/styles/brackets.less', 'utf8');
            var parser = new(less.Parser)({
                paths: ['src/styles'], // Specify search paths for @import directives
                filename: 'brackets.less' // Specify a filename, for better error messages
            });
            var deferred = q.defer();
            parser.parse(lessSrc, function(e, tree){
                if (e){
                    deferred.reject(e);
                }
                else{
                    var css = tree.toCSS({ compress: false });
                    fs.writeFileSync(path.join(buildDir, "styles", mainCssName), css);
                    deferred.resolve();
                }
            });
            return deferred.promise;
        }
        

        //qexec("r.js -o src/packagedApp/build-config.js out=" + scriptOut, opts);
        

        // run require js optimizaton on all of the default extensions
        var funcs = [];
        var extensionScripts = [];
        var directories = fs.readdirSync(path.join(process.cwd(), "src/extensions/default"));
        directories.forEach(function(extensionDir){
            
            var outputFile = path.join(buildDir, 'extensions', extensionDir, 'main.js');

            fs.mkdirSync(path.dirname(outputFile));
            var optimizeExtension = function(){
                var config = {
                    //context: extensionDir,
                    name: "main",
                    paths: {
                        text: "../../../thirdparty/text",
                        hgn: "../../../thirdparty/hgn",
                        hogan: "../../../thirdparty/hogan"
                    },
                    hgn : {
                        templateExtension : ""
                    },
                    out: outputFile,
                    optimize: "none",
                    baseUrl: path.join(process.cwd(), "src/extensions/default", extensionDir)
                }
                var deferred = q.defer();
                requirejs.optimize(config, function(resp){
                    deferred.resolve();
                }, function(err){
                    deferred.reject(err);
                });
                return deferred.promise;
                //return qexec("r.js -o name=main paths.text=../../../thirdparty/text out=" + outputFile + " optimize=none", {cwd: extensionDir, maxBuffer: 1024*1024 })
            }
            
            // extensionScripts.push({src: path.join('extensions', extensionDir, 'main-built.js')});
            if (fs.statSync(path.join(process.cwd(), "src/extensions/default", extensionDir)).isDirectory()){
                funcs.push(optimizeExtension());
                extensionScripts.push({name: extensionDir, baseUrl: 'extensions/' + extensionDir});
            }
        });
        
        var compileMainTemplate= function(){
            var templateStr = fs.readFileSync('src/packagedApp/index.html.moustache', 'utf8');
            var template = hogan.compile(templateStr);
            var index = template.render({mainCss: mainCssName, mainScript: mainJsName, extensions: extensionScripts});
            fs.writeFileSync(path.join(buildDir, 'index.html'), index);

            templateStr = fs.readFileSync('src/packagedApp/extensionBootstrap.js', 'utf8');
            template = hogan.compile(templateStr);
            var bootstrap = template.render({extensions: extensionScripts});
            fs.writeFileSync(path.join(buildDir, 'extensionBootstrap.js'), bootstrap);
        }

        q.allResolved(funcs)
            .done(function(){
                compileMainTemplate();
                optimizeMainJs()
                .then(optimizeMainCss)
                .then(done);
            });
        
        
    });
}