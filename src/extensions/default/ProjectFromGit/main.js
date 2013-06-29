define(function (require, exports, module) {
    "use strict";

    var ProjectManager      = brackets.getModule("project/ProjectManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        NewProjectTemplate  = require("hgn!CreateProjectDialogTemplate.html"),
        GitImportTemplate   = require("hgn!GitImport.html"),
        AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        Strings             = brackets.getModule("strings");


    var welcomeMat = {
        launch: function(){
            Dialogs.showModalDialogUsingTemplate(NewProjectTemplate(), false);

            $('.git-import-btn').one('click', function(){
                Dialogs.cancelModalDialogIfOpen("new-project-dialog");
                Dialogs.showModalDialogUsingTemplate(GitImportTemplate(), false);
            });
        }
    }

    ProjectManager.registerWelcomeMat(welcomeMat);

    AppInit.htmlReady(function () {
        ExtensionUtils.loadStyleSheet(module, "dialog.css");
    });
});