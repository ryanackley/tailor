define(function (require, exports, module) {
    "use strict";

    var ProjectManager      = brackets.getModule("project/ProjectManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        NewProjectTemplate  = require("hgn!CreateProjectDialogTemplate.html"),
        GitImportTemplate   = require("hgn!GitImport.html"),
        AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        PlatformFileSystem  = brackets.getModule("file/PlatformFileSystem").PlatformFileSystem,
        GitApi              = require("thirdparty/gitlite.js/api-built"),
        Strings             = brackets.getModule("strings");

    function dirNameForGitUrl(path) {
        var index   = path.lastIndexOf("/"),
            dirName    = path.substring(index + 1, path.length);
        
        if (dirName.lastIndexOf(".git") == (dirName.length - 4)){
            dirName = dirName.substring(0, dirName.length - 4);
        }
        return dirName;
    }

    function errorHandler(e){

    }

    function getProjectsRootDir(callback){
        PlatformFileSystem.requestNativeFileSystem('projects', function(fs){
            callback(fs.root);
        }, function(e){
            PlatformFileSystem.requestNativeFileSystem(null, function(fs){
                fs.root.getDirectory("projects", {create:true}, callback, errorHandler);
            }, errorHandler);
        });
    }

    function promptForGitImport(){
        Dialogs.cancelModalDialogIfOpen("new-project-dialog");
        Dialogs.showModalDialogUsingTemplate(GitImportTemplate(), false);

        var cloneRepo = function(dirName, url){
            
        }

        $('.git-import-dialog button[data-button-id="ok"]').click(function(){
            var gitRepoUrl = $('.git-import-dialog .url').val(),
                dirName = dirNameForGitUrl(gitRepoUrl);

            getProjectsRootDir(function(projectsDir){
                projectsDir.getDirectory(dirName, {create:true}, function(newDir){
                    GitApi.clone(newDir, gitRepoUrl, function(){
                        ProjectManager.openProject(newDir.fullPath);
                        Dialogs.cancelModalDialogIfOpen('git-import-dialog');
                    });
                }, errorHandler);
            });

        });
    }

    function promptForNewProject(){
        Dialogs.showModalDialogUsingTemplate(NewProjectTemplate(), false);

        $('.git-import-btn').one('click', function(){
            promptForGitImport();
        });
    }

    var welcomeMat = {
        launch: function(){
            promptForNewProject();
        }
    }

    ProjectManager.registerWelcomeMat(welcomeMat);

    AppInit.htmlReady(function () {
        ExtensionUtils.loadStyleSheet(module, "dialog.css");
    });
});