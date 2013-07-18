(function(){
    require(["brackets", "utils/ExtensionLoader", "utils/Async"], function(brackets, extensionLoader, Async){
        
        var paths = {
            "text" : "../../thirdparty/text/text",
            "i18n" : "../../thirdparty/i18n/i18n",
            "hgn"  : "../../thirdparty/hgn",
            "hogan": "../../thirdparty/hogan"
        };

        var extensions = [];
        var processItem = function(item){
            if (item.name == "ProjectFromGit"){
                extensionLoader.loadExtension(item.name, item.data, item.module).always(function(){
                    extensionLoader.notifyPluginsLoaded();
                });
            
            }
            else{
                extensions.push(item);
            }
        }

       
        {{#extensions}}
        var item  = {name:"{{name}}", data: { baseUrl: "{{baseUrl}}", paths: paths}, module: "main"};
        processItem(item);
        {{/extensions}}

        Async.doInParallel(extensions, function (item) {
            return extensionLoader.loadExtension(item.name, item.data, item.module);
        }).always(function(){
            //extensionLoader.notifyPluginsLoaded();
        });
    });
})();