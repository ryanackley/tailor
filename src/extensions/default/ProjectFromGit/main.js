define(function (require, exports, module) {
    "use strict";

    var ProjectManager      = brackets.getModule("project/ProjectManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        NewProjectTemplate  = require("hgn!CreateProjectDialogTemplate.html"),
        GitImportTemplate   = require("hgn!GitImport.html"),
        ProgressTemplate    = require("hgn!ProgressTemplate.html"),
        CommitFormTemplate  = require("hgn!CommitForm.html"),
        AuthTemplate        = require("hgn!AuthDialog.html"),
        BranchTemplate      = require("hgn!BranchDialog.html"),
        CheckoutTemplate    = require("hgn!CheckoutDialog.html"),
        BlankProjectTemplate = require("hgn!BlankProject.html"),
        AppInit             = brackets.getModule("utils/AppInit"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        PlatformFileSystem  = brackets.getModule("file/PlatformFileSystem").PlatformFileSystem,
        GitApi              = require("thirdparty/gitlite.js/api-built"),
        Menus               = brackets.getModule("command/Menus"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Commands            = brackets.getModule("command/Commands"),
        FileSyncManager     = brackets.getModule("project/FileSyncManager");
        Strings             = brackets.getModule("strings");

    var gitSettings = {};
    chrome.storage.local.get('git', function(obj){
        if (obj)
            gitSettings = obj['git'] || gitSettings;
    });

    var storeGitSettings = function(){
        chrome.storage.local.set({git : gitSettings});
    }

    $(document.body).on('click', '.git-cancel', function(e){
        Dialogs.cancelModalDialogIfOpen('modal');
    });

    function dirNameForGitUrl(path) {
        var index   = path.lastIndexOf("/"),
            dirName    = path.substring(index + 1, path.length);
        
        if (dirName.lastIndexOf(".git") == (dirName.length - 4)){
            dirName = dirName.substring(0, dirName.length - 4);
        }
        return dirName;
    }

    function authError(authHdr, dir, retry){
        var realmIdx = authHdr.toLowerCase().indexOf('realm="');
        var realm;
        if (realmIdx != -1){
            var endIdx = authHdr.indexOf('"', realmIdx + 7);
            if(endIdx != -1){
                realm = authHdr.substring(realmIdx + 7, endIdx);
            }
        }
        realm = realm || "Unknown";
        Dialogs.showModalDialogUsingTemplate(AuthTemplate({realm:realm}), false);
        $('.git-auth-dialog .primary').click(function(){
            var username = $('#inputUsername').val();
            var password = $('#inputPassword').val();
            dir = dir.fullPath || ProjectManager.getProjectRoot().fullPath;
            var settings = gitSettings[dir] || {};
            settings.username = username;
            settings.password = password;

            gitSettings[dir] = settings;
            storeGitSettings();
            Dialogs.cancelModalDialogIfOpen('git-auth-dialog');
            retry();
        });
    }

    function genericErrorHandler(title){
        return function(e){
            Dialogs.cancelModalDialogIfOpen('modal');
            Dialogs.showModalDialog('git-error', title, e.msg);
        }
    }

    function fileErrorHandler(e){
        Dialogs.cancelModalDialogIfOpen("modal");
        Dialogs.showModalDialog('git-file-error', 'Unexpected File Error', 'File error code is ' + e.code);
    }

    function getProjectsRootDir(callback){
        PlatformFileSystem.requestNativeFileSystem('projects', function(fs){
            callback(fs.root);
        }, function(e){
            PlatformFileSystem.requestNativeFileSystem(null, function(fs){
                fs.root.getDirectory("projects", {create:true}, callback, fileErrorHandler);
            }, fileErrorHandler);
        });
    }

    function newBlankProject(fromWelcomeMat){
        Dialogs.cancelModalDialogIfOpen("new-project-dialog");
        Dialogs.showModalDialogUsingTemplate(BlankProjectTemplate(), false);

        var inlineError = function(msg){
            $('.git-blank-dialog .help-block').text(msg).show();
        }
        $('.git-blank-dialog .primary').click(function(){
            var projectName = $('#inputProjectName').val();
            if (!projectName || projectName.trim().length == 0){
                inlineError('Project name can\'t be blank');
                return;
            }
            else{
                getProjectsRootDir(function(projectsDir){
                    projectsDir.getDirectory(projectName, {create: true, exclusive: true}, function(newDir){
                        ProjectManager.openProject(newDir.fullPath);
                        Dialogs.cancelModalDialogIfOpen('git-blank-dialog');
                    },
                    function(e){
                        inlineError('File error code: ' + e.code + ' try again');
                    });
                });
            }

        });

        $('.git-blank-dialog .git-create-cancel').click(function(e){
            Dialogs.cancelModalDialogIfOpen("modal");
            if (fromWelcomeMat){
                promptForNewProject(fromWelcomeMat);
            }
        });
    }

    function createProgressMonitor(){
        var bar = $('.git-progress .bar')[0];
        var $msg = $('#import-status')

        var progress = function(data){
            bar.style.width = data.pct + '%';
            $msg.text(data.msg);
        }
        return progress;
    }

    function showBitbucketError(){
        return Dialogs.showModalDialog('git-bb-error', 'Bitbucket', 'Tailor cannot pull from or push to remote repositories on Bitbucket. The root cause is <a href="https://bitbucket.org/site/master/issue/6666/detect-git-requests-by-content-type-header" target="_blank">this issue</a>. Comment on that issue or <a href="https://support.atlassian.com" target="_blank">contact Atlassian support</a> if you want to see this fixed.');
    }

    function doGitImport(options){
        
        var gitRepoUrl = options.url,//$('.git-import-dialog .url').val(),
            username = options.username,
            password = options.password,
            fromWelcomeMat = options.fromWelcomeMat;
            dirName = dirNameForGitUrl(gitRepoUrl);


        Dialogs.cancelModalDialogIfOpen("git-import-dialog");
        
        if (username && password){
            gitSettings['/projects/' + dirName] = {username: username, password: password};
            storeGitSettings();
        }

        var cloneError = function(e){
            Dialogs.cancelModalDialogIfOpen('git-progress');
            var result;
            if (e.type == GitApi.HTTP_AUTH_ERROR){
                authError(e.auth, newDir, doClone);
            }
            else if (e.type == GitApi.AJAX_ERROR && e.url.indexOf('bitbucket.org') != -1){
                result = showBitbucketError();
            }
            else{
                result = Dialogs.showModalDialog('git-clone-error', 'Clone error', e.msg);
            }
            if (result && fromWelcomeMat){
                result.done(function(){
                    promptForNewProject(true);
                });
            }
        }

        var newDir;
        var doClone = function(){
            var settings = gitSettings['/projects/' + dirName] || {};
            var username = settings.username,
                password = settings.password;

            var progress = showProgress("Cloning Git Repo...", "Connecting to server...");
            GitApi.clone({dir: newDir, url: gitRepoUrl, depth: 1, progress: progress, username:username, password:password}, function(){
                ProjectManager.openProject(newDir.fullPath);
                Dialogs.cancelModalDialogIfOpen('git-progress');
            }, cloneError);
        }

        getProjectsRootDir(function(projectsDir){
            projectsDir.getDirectory(dirName, {create:true}, function(dir){
                newDir = dir;
                doClone();
            }, fileErrorHandler);
        });
    }

    function promptForGitImport(fromWelcomeMat){
        // Dialogs.cancelModalDialogIfOpen("new-project-dialog");
        // Dialogs.showModalDialogUsingTemplate(GitImportTemplate({title: "Import from Git"}), false);

        // $('.git-import-dialog button[data-button-id="ok"]').click(doGitImport);
        showAndValidateGitRemoteSetup("Git Import", fromWelcomeMat, doGitImport);
    }


    function showAndValidateGitRemoteSetup(title, fromWelcomeMat, callback){
        Dialogs.cancelModalDialogIfOpen("modal");
        Dialogs.showModalDialogUsingTemplate(GitImportTemplate({title: title}), false);

        $('.git-import-dialog button[data-button-id="ok"]').click(function(){
            var gitRepoUrl = $('.git-import-dialog .url').val(),
                username = $('#inputUsername').val(),
                password = $('#inputPassword').val();

            if (!gitRepoUrl || !gitRepoUrl.trim().length){
                $('.git-import-dialog .help-block').text('URL can\'t be blank').show();
            }
            else{
                callback({url: gitRepoUrl, username: username, password: password, fromWelcomeMat: fromWelcomeMat});
            }
        });

        $('.git-import-dialog .git-create-cancel').click(function(e){
            Dialogs.cancelModalDialogIfOpen("modal");
            if (fromWelcomeMat){
                promptForNewProject(true);
            }
        });
    }

    function promptForNewProject(fromWelcomeMat){
        var cancelable = !fromWelcomeMat;
        Dialogs.showModalDialogUsingTemplate(NewProjectTemplate({cancelable: cancelable}), false);

        $('.git-import-btn').one('click', function(){
            promptForGitImport(fromWelcomeMat);
        });
        $('.new-project-btn').one('click', function(){
            newBlankProject(fromWelcomeMat);
        });
    }

    var welcomeMat = {
        launch: function(){
            promptForNewProject(true);
        }
    }

    function doPull(){
        var dir = ProjectManager.getProjectRoot();

        var pullError = function(e){
            Dialogs.cancelModalDialogIfOpen('git-progress');
            if (e.type == GitApi.HTTP_AUTH_ERROR){
                authError(e.auth, dir, pushInternal);
            }
            else{
                Dialogs.showModalDialog('git-pull-error', 'Pull error', e.msg);
            }
        }
        var pullInternal = function(){
            var settings = gitSettings[dir.fullPath] || {};
            var progress = showProgress("Pulling from Remote Repo", "Looking for uncommitted changes...")
            GitApi.pull({dir: dir, username: settings.username, password: settings.password, progress: progress}, function(){
                Dialogs.cancelModalDialogIfOpen('git-progress');
                Dialogs.showModalDialog('git-pull-success', 'Pull successful', 'The pull was successful');
                ProjectManager.refreshFileTree();
                refreshOpenEditors();
            },pullError)
        }
        CommandManager.execute(Commands.FILE_CLOSE_ALL, { promptOnly: true }).done(function () {
            pullInternal();
        });
    }

    function showProgress(title, initialMsg){
        //if (toClose){
        Dialogs.cancelModalDialogIfOpen('modal');
        //}
        Dialogs.showModalDialogUsingTemplate(ProgressTemplate({title: title, initialMsg: initialMsg}), false);
        return createProgressMonitor();
    }

    function doPush(){
        

        var pushError = function(e){
            Dialogs.cancelModalDialogIfOpen('modal');
            if (e.type == GitApi.HTTP_AUTH_ERROR){
                authError(e.auth, dir, pushInternal);
            }
            else if (e.type == GitApi.AJAX_ERROR && e.url.indexOf('bitbucket.org') != -1){
                showBitbucketError();
            }
            else{
                Dialogs.showModalDialog('git-push-error', 'Push error', e.msg);
            } 
        }

        var dir = ProjectManager.getProjectRoot();

        var pushInternal = function(url){
            var progress = showProgress("Pushing to Remote Repo", "Looking for new changes...");
            var settings = gitSettings[dir.fullPath] || {};
            var options = {dir:dir, username: settings.username, password: settings.password, progress:progress};
            if (url){
                options.url = url;
            }
            GitApi.push(options, function(){
                Dialogs.cancelModalDialogIfOpen('git-progress');
                Dialogs.showModalDialog('git-push-success', 'Push successful', 'The push was successful');
            }, function(e){
                if (e.type == GitApi.PUSH_NO_REMOTE){
                    showAndValidateGitRemoteSetup("Push to a Remote Git Repo", false, function(options){
                        var gitRepoUrl = options.url,//$('.git-import-dialog .url').val(),
                            username = options.username,
                            password = options.password;

                        if (username && password){
                            gitSettings[dir.fullPath] = {username: username, password: password};
                            storeGitSettings();
                        }
                        pushInternal(gitRepoUrl);
                    });
                }
                else{
                    pushError(e);
                }
            });
        }
        CommandManager.execute(Commands.FILE_CLOSE_ALL, { promptOnly: true })
            .done(function () {
                GitApi.checkForUncommittedChanges({dir: dir}, function(){pushInternal()}, function(){
                    Dialogs.showModalDialog("git-new-changes", 
                                            "Uncommitted Changes", 
                                            "You have uncommitted changes in your working copy. Do you want to commit them before pushing?",
                                            [{ className: Dialogs.DIALOG_BTN_CLASS_PRIMARY, id: Dialogs.DIALOG_BTN_OK, text: "Yes" },
                                             { className: Dialogs.DIALOG_BTN_CLASS_NORMAL, id: Dialogs.DIALOG_BTN_CANCEL, text: "No"}]);
                    //doCommitInternal(pushInternal);

                    $('.git-new-changes .dialog-button').click(function(e){
                        if ($(this).hasClass('primary')){
                            doCommitInternal(pushInternal)
                        }else{
                            pushInternal();
                        }
                    });
                });
            });

        //Dialogs.showModalDialogUsingTemplate(CommitFormTemplate(), false);
        //$('.git-commit-dialog .primary').click(function(){
            
            //GitApi.commit({dir:dir, name: $('#inputName').val(), email: $('#inputEmail').val(), commitMsg: $('#inputCommitMsg').val()}, function(){
                //pushInternal();
            //}, commitError);
        //});
    }

    function doCommit(){
        CommandManager.execute(Commands.FILE_CLOSE_ALL, { promptOnly: true }).done(function () {
            doCommitInternal(function(){
                Dialogs.showModalDialog('git-commit-success', 'Commit successful', 'The commit was successful');
            });
        });
    }

    function doBranch(){
        var dir = ProjectManager.getProjectRoot();
        var branchError = genericErrorHandler('Branch Error');

        var inlineBranchError = function(msg){
            $('.git-branch-dialog .help-block').text(msg).show();
        }

        GitApi.getCurrentBranch({dir: dir}, function(branchName){
            Dialogs.showModalDialogUsingTemplate(BranchTemplate({currentBranch: branchName}), false);
            $('.git-branch-dialog .primary').click(function(){
                var newBranchName = $('#inputBranch').val();
                if (!newBranchName || newBranchName.trim().length == 0){
                    inlineBranchError('Branch name is blank');
                }
                else{
                    GitApi.branch({dir: dir, branch: newBranchName}, function(){
                        Dialogs.cancelModalDialogIfOpen('git-branch-dialog');
                        Dialogs.showModalDialog('git-branch-success', 'Branch successful', 'Branch \'' + newBranchName + '\' successfully created');
                    },
                    function(e){
                        inlineBranchError(e.msg);
                    });
                }
            });
        }, branchError);
    }
    function refreshOpenEditors(){
        FileSyncManager.syncOpenDocuments('sdasdasd');
    }

    function doCheckout(){
        var dir = ProjectManager.getProjectRoot();

        var checkoutError = genericErrorHandler('Checkout Error');

        var scrubBranchList = function(branches, currentBranch){
            var idx = branches.indexOf(currentBranch);
            if (idx != -1){
                branches.splice(idx, 1);
            }
        }

        CommandManager.execute(Commands.FILE_CLOSE_ALL, { promptOnly: true }).done(function () {
            GitApi.getLocalBranches({dir: dir}, function(branches){
                GitApi.getCurrentBranch({dir: dir}, function(currentBranch){
                    scrubBranchList(branches, currentBranch);
                    if (branches.length){
                        Dialogs.showModalDialogUsingTemplate(CheckoutTemplate({branches: branches, currentBranch: currentBranch}), false);
                        $('.git-checkout-dialog select').val(branches[0]);
                        $('.git-checkout-dialog .primary').click(function(){
                            var newBranch = $('.git-checkout-dialog select').val();
                            GitApi.checkout({dir: dir, branch: newBranch}, function(){
                                ProjectManager.refreshFileTree();
                                Dialogs.cancelModalDialogIfOpen('git-checkout-dialog');
                                Dialogs.showModalDialog('git-checkout-success', 'Checkout successful', 'Checked out \'' + newBranch + '\' successfully.');
                                refreshOpenEditors();
                            }, checkoutError);
                        })
                    }
                    else{
                        checkoutError({msg: 'No local branches to checkout'});
                    }

                }, checkoutError);
            }, checkoutError);
        });
    };

    function doCommitInternal(callback){
        var dir = ProjectManager.getProjectRoot();
        var commitError = function(e){
            Dialogs.cancelModalDialogIfOpen('modal');
            Dialogs.showModalDialog('git-commit-error', 'Commit Error', e.msg);       
        }

        var settings = gitSettings[dir.fullPath] || {},
            name = settings.name || "",
            email = settings.email || "",
            focusOnMsg = name.trim().length > 0 || email.trim().length > 0;


        Dialogs.showModalDialogUsingTemplate(CommitFormTemplate({name: name, email: email}), false);
        var focusSelector = focusOnMsg ? '#inputCommitMsg': '#inputEmail';
        $(focusSelector).focus();

        $('.git-commit-dialog .primary').click(function(){
            settings.name = $('#inputName').val();
            settings.email = $('#inputEmail').val();

            var options = {dir:dir, name: settings.name, email: settings.email, commitMsg: $('#inputCommitMsg').val()}
            var progress = showProgress("Commit", "Finding the latest changes...");
            progress({pct: 95, msg: "Finding the latest changes..."});

            GitApi.commit(options, function(){
                gitSettings[dir.fullPath] = settings;
                storeGitSettings();
                Dialogs.cancelModalDialogIfOpen('git-progress');
                callback();
            }, commitError);
        });
    }

    ProjectManager.registerWelcomeMat(welcomeMat);

    CommandManager.register('Pull', 'pull', doPull);
    CommandManager.register('Push', 'push', doPush);
    CommandManager.register('Commit', 'commit', doCommit);
    CommandManager.register('Branch', 'branch', doBranch);
    CommandManager.register('Checkout', 'checkout', doCheckout);
    CommandManager.register('Tailor project home page', "gotailorhome", function(){window.open("https://github.com/ryanackley/tailor", "_blank")});

    var menu = Menus.addMenu('Git', 'git', Menus.BEFORE, Menus.AppMenuBar.HELP_MENU);
    menu.addMenuItem('pull');
    menu.addMenuItem('push');
    menu.addMenuItem('commit');
    menu.addMenuItem('branch');
    menu.addMenuItem('checkout');

    AppInit.htmlReady(function () {
        ExtensionUtils.loadStyleSheet(module, "dialog.css");
        //window.setTimeout(function(){
        var fileMenu = Menus.getMenu(Menus.AppMenuBar.FILE_MENU);
        fileMenu.removeMenuItem(Commands.FILE_OPEN);
        fileMenu.removeMenuItem(Commands.FILE_LIVE_FILE_PREVIEW);
        fileMenu.removeMenuItem(Commands.FILE_LIVE_HIGHLIGHT);
        fileMenu.removeMenuItem(Commands.FILE_PROJECT_SETTINGS);
        
        fileMenu.removeMenuItem(Commands.FILE_EXTENSION_MANAGER);
        $('#' + fileMenu.id + ' .divider').parent().remove();

        fileMenu.addMenuDivider(Menus.AFTER, Commands.FILE_CLOSE_ALL);

        var helpMenu = Menus.getMenu(Menus.AppMenuBar.HELP_MENU);
        helpMenu.removeMenuItem(Commands.HELP_CHECK_FOR_UPDATE);
        helpMenu.removeMenuItem(Commands.HELP_HOW_TO_USE_BRACKETS);
        helpMenu.removeMenuItem(Commands.HELP_FORUM);
        helpMenu.removeMenuItem(Commands.HELP_RELEASE_NOTES);
        helpMenu.removeMenuItem(Commands.HELP_REPORT_AN_ISSUE);
        helpMenu.removeMenuItem(Commands.HELP_SHOW_EXT_FOLDER);
        helpMenu.removeMenuItem(Commands.HELP_TWITTER);
        helpMenu.removeMenuItem(Commands.HELP_ABOUT);
        $('#' + helpMenu.id + ' .divider').parent().remove();
        helpMenu.addMenuItem("gotailorhome");


    //}, 15000);

        var folderOpen = CommandManager.get(Commands.FILE_OPEN_FOLDER);
        folderOpen.setName('New Project...')
        folderOpen._commandFn = promptForNewProject;
        // so it's picked up by the recent projects list.
        Strings.CMD_OPEN_FOLDER = 'New Project...';
    });
});