/*
 * Copyright (c) Codiad & Andr3as, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information. 
 * This information must remain intact.
 */

(function(global, $){
    
    var codiad = global.codiad,
        scripts = document.getElementsByTagName('script'),
        path = scripts[scripts.length-1].src.split('?')[0],
        curpath = path.split('/').slice(0, -1).join('/')+'/';

    $(function() {
        codiad.CodeGit.init();
    });

    codiad.CodeGit = {
        
        path    : curpath,
        location: '',
        line    : 0,
        files   : [],
        
        init: function() {
            var _this = this;
            //Check if directories has git repo
            amplify.subscribe('filemanager.onIndex', function(obj){
                setTimeout(function(){
                    $.each(obj.files, function(i, item){
                        if (_this.basename(item.name) == '.git') {
                            $('.directory[data-path="'+_this.dirname(item.name)+'"]').addClass('repo');
                        } else if (item.type == 'directory') {
                            //Deeper inspect
                            $.getJSON(_this.path + 'controller.php?action=checkRepo&path=' + item.name, function(result){
                                if (result.status) {
                                    $('.directory[data-path="'+item.name+'"]').addClass('repo');
                                }
                            });
                        }
                    });
                },0);
            });
            //Handle context-menu
            amplify.subscribe('context-menu.onShow', function(obj){
                if ($(obj.e.target).hasClass('directory')) {
                    $('#context-menu').append('<hr class="directory-only code_git">');
                    if ($(obj.e.target).hasClass('repo')) {
                        $('#context-menu').append('<a class="directory-only code_git" onclick="codiad.CodeGit.showDialog(\'overview\', $(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Open CodeGit</a>');
                    } else {
                        $('#context-menu').append('<a class="directory-only code_git" onclick="codiad.CodeGit.gitInit($(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Git Init</a>');
                        $('#context-menu').append('<a class="directory-only code_git" onclick="codiad.CodeGit.clone($(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Git Clone</a>');
                    }
                } else {
                    var path = $(obj.e.target).attr('data-path');
                    var root = $('#project-root').attr('data-path');
                    var counter = 0;
                    while (path != root) {
                        path = _this.dirname(path);
                        if ($('.directory[data-path="' + path + '"]').hasClass('repo')) {
                            $('#context-menu').append('<hr class="file-only code_git">');
                            $('#context-menu').append('<a class="file-only code_git" onclick="codiad.CodeGit.contextMenuDiff($(\'#context-menu\').attr(\'data-path\'), \''+_this.dirname(path)+'\');"><span class="icon-flow-branch"></span>Git Diff</a>');
                            //Git rename
                            $('#context-menu a[onclick="codiad.filemanager.renameNode($(\'#context-menu\').attr(\'data-path\'));"]')
                                .attr("onclick", "codiad.CodeGit.rename($(\'#context-menu\').attr(\'data-path\'))");
                            break;
                        }
                        if (counter >= 10) break;
                        counter++;
                    }
                }
            });
            amplify.subscribe("context-menu.onHide", function(){
                $('.code_git').remove();
            });
            //File stats
            $('#current-file').after('<div class="divider"></div><div id="git-stat"></div>');
            amplify.subscribe('active.onFocus', function(path){
                _this.numstat(path);
            });
            amplify.subscribe('active.onSave', function(path){
                setTimeout(function(){
                    _this.numstat(path);
                }, 50);
            });
            amplify.subscribe('active.onClose', function(path){
                $('#git-stat').html("");
            });
            amplify.subscribe('active.onRemoveAll', function(){
                $('#git-stat').html("");
            });
            //Live features
            $('.git_area #check_all').live("click", function(e){
                if ($('.git_area #check_all').attr("checked") == "checked") {
                    $('.git_area input:checkbox').attr("checked", "checked");
                } else {
                    $('.git_area input:checkbox').removeAttr("checked");
                }
            });
            $('.git_area input:checkbox:not(#check_all)').live("click", function(e){
                if ($(this).attr("checked") != "checked") {
                    //One gets unchecked, remove all_input checking
                    if ($('.git_area #check_all').attr("checked") == "checked") {
                        $('.git_area #check_all').removeAttr("checked");
                    }
                } else {
                    var all = true;
                    $('.git_area input:checkbox:not(#check_all)').each(function(i, item){
                        all = all && ($(this).attr("checked") == "checked");
                    });
                    if (all) {
                        $('.git_area #check_all').attr("checked", "checked");
                    }
                }
            });
            //Button Click listener
            $('.git_area .git_diff').live("click", function(e){
                e.preventDefault();
                var line = $(this).attr('data-line');
                var path = $('.git_area .git_list .file[data-line="'+line+'"]').text();
                _this.files = [];
                _this.files.push(path);
                _this.showDialog('diff', _this.location);
            });
            $('.git_area .git_undo').live("click", function(e){
                e.preventDefault();
                var line = $(this).attr('data-line');
                var path = $('.git_area .git_list .file[data-line="'+line+'"]').text();
                _this.checkout(path, _this.location);
                _this.showDialog('overview', _this.location);
            });
            $('.git_diff_area .git_undo').live("click", function(e){
                e.preventDefault();
                _this.checkout(_this.files[0], _this.location);
                _this.showDialog('overview', _this.location);
            });
        },
        
        showSidebarDialog: function() {
            if (!$('#project-root').hasClass('repo')) {
                codiad.message.error('Project root has no repository. Use the context menu!');
                return;
            }
            codiad.CodeGit.showDialog('overview', $('#project-root').attr('data-path'));
        },
        
        showDialog: function(type, path) {
            this.location = path || this.location;
            codiad.modal.load(600, this.path + 'dialog.php?action=' + type);
        },
        
        showCommitDialog: function(path) {
            var _this = this;
            $.getJSON(this.path + 'controller.php?action=getSettings', function(data){
                if (data.status == "success") {
                    if (data.data.email === ""){
                        codiad.message.notice("Please tell git who you are:");
                        _this.showDialog('settings', _this.location);
                    } else {
                        path = _this.getPath(path);
                        var files = [], line = 0, file = "";
                        $('.git_area .git_list input:checkbox[checked="checked"]').each(function(i, item){
                            line = $(item).attr('data-line');
                            file = $('.git_area .git_list .file[data-line="'+line+'"]').text();
                            files.push(file);
                        });
                        _this.files = files;
                        _this.showDialog('commit', _this.location);
                    }
                } else {
                    codiad.message.error(data.message);
                }
            });
        },
        
        gitInit: function(path) {
            $.getJSON(this.path + 'controller.php?action=init&path=' + path, function(result){
                codiad.message[result.status](result.message);
                if (result.status == 'success') {
                    $('.directory[data-path="'+path+'"]').addClass('hasRepo');
                    codiad.filemanager.rescan(path);
                }
            });
        },
        
        clone: function(path, repo) {
            var _this = this;
            if (typeof(repo) == 'undefined') {
                this.showDialog('clone', path);
            } else {
                codiad.modal.unload();
                $.getJSON(_this.path + 'controller.php?action=clone&path=' + path + '&repo=' + repo, function(result){
                    if (result.status == 'login_required') {
                        codiad.message.error(result.message);
                        _this.showDialog('login', _this.location);
                        _this.login = function(){
                            var username = $('.git_login_area #username').val();
                            var password = $('.git_login_area #password').val();
                            codiad.modal.unload();
                            $.post(_this.path + 'controller.php?action=clone&path='+path+'&repo=' + repo, {username: username, password: password},
                                function(result){
                                    result = JSON.parse(result);
                                    codiad.message[result.status](result.message);
                                    if (result.status == 'success') {
                                        codiad.filemanager.rescan(path);
                                    }
                                });
                        };
                    } else {
                        codiad.message[result.status](result.message);
                    }
                    if (result.status == 'success') {
                        codiad.filemanager.rescan(path);
                    }
                });
            }
        },
        
        diff: function(path, repo) {
            var _this   = this;
            repo        = this.getPath(repo);
            $.getJSON(this.path + 'controller.php?action=diff&repo=' + repo + '&path=' + path, function(result){
                if (result.status != 'success') {
                    codiad.message[result.status](result.message);
                    _this.showDialog('overview', repo);
                    return;
                }
                $.each(result.data, function(i, item){
                    item = item.replace(new RegExp('\t', 'g'), ' ')
                                .replace(new RegExp(' ', 'g'), "&nbsp;")
                                .replace(new RegExp('\n', 'g'), "<br>");
                    if (item.indexOf('+') === 0 && item.indexOf('+++') !== 0) {
                        $('.git_diff').append('<li class="plus">' + item + '</li>');
                    } else if (item.indexOf('-') === 0 && item.indexOf('---') !== 0) {
                        $('.git_diff').append('<li class="minus">' + item + '</li>');
                    } else {
                        $('.git_diff').append('<li>' + item + '</li>');
                    }
                });
            });
        },
        
        contextMenuDiff: function(path, repo) {
            this.location   = repo;
            path            = path.replace(repo + "/", "");
            this.files      = [];
            this.files.push(path);
            this.showDialog('diff', repo);
        },
        
        commit: function(path, msg) {
            var _this = this;
            path = this.getPath(path);
            var message = $('.git_commit_area #commit_msg').val();
            this.showDialog('overview', this.location);
            $.post(this.path + 'controller.php?action=add&path=' + path, {files : JSON.stringify(_this.files)}, function(result){
                result = JSON.parse(result);
                if (result.status == 'error') {
                    codiad.message.error(result.message);
                    return;
                }
                $.post(_this.path + 'controller.php?action=commit&path=' + path, {message: message}, function(result){
                    result = JSON.parse(result);
                    codiad.message[result.status](result.message);
                    _this.status(path);
                });
            });
        },
        
        filesDiff: function() {
            var _this = this;
            $.each(this.files, function(i, item){
                _this.diff(item, _this.location);
            });
        },
        
        push: function() {
            var _this   = this;
            var remote  = $('.git_push_area #git_remotes').val();
            var branch  = $('.git_push_area #git_branches').val();
            this.showDialog('overview', this.location);
            $.getJSON(this.path + 'controller.php?action=push&path=' + this.location + '&remote=' + remote + '&branch=' + branch, function(result){
                if (result.status == 'login_required') {
                    codiad.message.error(result.message);
                    _this.showDialog('login', _this.location);
                    _this.login = function(){
                        var username = $('.git_login_area #username').val();
                        var password = $('.git_login_area #password').val();
                        _this.showDialog('overview', _this.location);
                        $.post(_this.path + 'controller.php?action=push&path=' + _this.location + '&remote=' + remote + '&branch=' + branch,
                            {username: username, password: password}, function(result){
                                result = JSON.parse(result);
                                codiad.message[result.status](result.message);
                            });
                    };
                } else if (result.status == 'passphrase_required') {
                    codiad.message.error(result.message);
                    _this.showDialog('passphrase', _this.location);
                    _this.login = function() {
                        var passphrase = $('.git_login_area #passphrase').val();
                        _this.showDialog('overview', _this.location);
                        $.post(_this.path + 'controller.php?action=push&path=' + _this.location + '&remote=' + remote + '&branch=' + branch,
                            {passphrase: passphrase}, function(result){
                                result = JSON.parse(result);
                                codiad.message[result.status](result.message);
                            });
                    };
                } else {
                    codiad.message[result.status](result.message);
                }
            });
        },
        
        pull: function() {
            var _this = this;
            var remote  = $('.git_push_area #git_remotes').val();
            var branch  = $('.git_push_area #git_branches').val();
            this.showDialog('overview', this.location);
            $.getJSON(this.path + 'controller.php?action=pull&path=' + this.location + '&remote=' + remote + '&branch=' + branch, function(result){
                if (result.status == 'login_required') {
                    codiad.message.error(result.message);
                    _this.showDialog('login', _this.location);
                    _this.login = function(){
                        var username = $('.git_login_area #username').val();
                        var password = $('.git_login_area #password').val();
                        _this.showDialog('overview', _this.location);
                        $.post(_this.path + 'controller.php?action=pull&path=' + _this.location + '&remote=' + remote + '&branch=' + branch,
                            {username: username, password: password}, function(result){
                                result = JSON.parse(result);
                                codiad.message[result.status](result.message);
                            });
                    };
                } else if (result.status == 'passphrase_required') {
                    codiad.message.error(result.message);
                    _this.showDialog('passphrase', _this.location);
                    _this.login = function() {
                        var passphrase = $('.git_login_area #passphrase').val();
                        _this.showDialog('overview', _this.location);
                        $.post(_this.path + 'controller.php?action=pull&path=' + _this.location + '&remote=' + remote + '&branch=' + branch,
                            {passphrase: passphrase}, function(result){
                                result = JSON.parse(result);
                                codiad.message[result.status](result.message);
                            });
                    };
                } else {
                    codiad.message[result.status](result.message);
                }
            });
        },
        
        checkout: function(path, repo) {
            var result = confirm("Are you sure to undo the changes on: " + path);
            if (result) {
                $.getJSON(this.path + 'controller.php?action=checkout&repo=' + repo + '&path=' + path, function(result){
                    codiad.message[result.status](result.message);
                });
            }
        },
        
        status: function(path) {
            path = this.getPath(path);
            var _this = this;
            $.getJSON(this.path + 'controller.php?action=status&path=' + path, function(result){
                if (result.status == 'error') {
                    codiad.message.error(result.message);
                    return;
                }
                //Reset list
                $('.git_list tbody').html('');
                var added, deleted, modified, renamed, untracked;
                added = result.data.added;
                deleted = result.data.deleted;
                modified = result.data.modified;
                renamed = result.data.renamed;
                untracked = result.data.untracked;
                //Add entries
                $.each(added, function(i, item){
                    _this.addLine("Added", item);
                });
                $.each(deleted, function(i, item){
                    _this.addLine("Deleted", item);
                });
                $.each(modified, function(i, item){
                    _this.addLine("Modified", item);
                });
                $.each(renamed, function(i, item) {
                    _this.addLine("Renamed", item);
                });
                $.each(untracked, function(i, item) {
                    _this.addLine("Untracked", item);
                });
                _this.setBranch(result.data.branch);
            });
        },
        
        log: function(path) {
            path = this.getPath(path);
            $.getJSON(this.path + 'controller.php?action=log&path=' + path, function(result){
                if (result.status == 'error') {
                    codiad.message.error(result.message);
                    return;
                }
                $.each(result.data, function(i, item){
                    item = item.replace(new RegExp(" ", "g"), "&nbsp;");
                    if (item.indexOf("commit") === 0) {
                        $('.git_log_area .git_log').append('<li class="commit_hash">' + item + '</li>');
                    } else {
                        $('.git_log_area .git_log').append('<li>' + item + '</li>');
                    }
                });
            });
        },
        
        getRemotes: function(path) {
            path = this.getPath(path);
            $.getJSON(this.path + 'controller.php?action=getRemotes&path=' + path, function(result){
                if (result.status == 'error') {
                    codiad.message.error(result.message);
                    return;
                }
                $.each(result.data, function(i, item){
                    $('#git_remotes').append('<option value="'+i+'">'+i+'</option>');
                });
                $.each(result.data, function(i, item){
                    $('.git_remote_info').html(item);
                    return false;
                });
                $('#git_remotes').live('change', function(){
                    var value = $('#git_remotes').val();
                    $('.git_remote_info').html(result.data[value]);
                });
            });
        },
        
        newRemote: function(path) {
            var _this   = this;
            path        = this.getPath(path);
            var name    = $('.git_new_remote_area #remote_name').val();
            var url     = $('.git_new_remote_area #remote_url').val();
            $.getJSON(this.path + 'controller.php?action=newRemote&path=' + path + '&name=' + name + '&url=' + url, function(result){
                _this.showDialog('overview', _this.location);
                codiad.message[result.status](result.message);
            });
        },
        
        removeRemote: function(path) {
            var _this   = this;
            path        = this.getPath(path);
            var name    = $('#git_remotes').val();
            var result  = confirm("Are you sure to remove the remote: " + name);
            if (result) {
                $.getJSON(this.path + 'controller.php?action=removeRemote&path=' + path + '&name=' + name, function(result){
                    codiad.message[result.status](result.message);
                });
            }
            this.showDialog('overview', this.location);
        },
        
        renameRemote: function(path) {
            path        = this.getPath(path);
            var name    = $('#git_remote').text();
            var newName = $('#git_new_name').val();
            $.getJSON(this.path + 'controller.php?action=renameRemote&path=' + path + '&name=' + name + '&newName=' + newName, function(result){
                codiad.message[result.status](result.message);
            });
            this.showDialog('overview', this.location);
        },
        
        getBranches: function(path) {
            path = this.getPath(path);
            $.getJSON(this.path + 'controller.php?action=getBranches&path=' + path, function(result){
                if (result.status == 'error') {
                    codiad.message.error(result.message);
                    return;
                }
                $.each(result.data.branches, function(i, item){
                    $('#git_branches').append('<option value="'+item+'">'+item+'</option>');
                });
                $('#git_branches').val(result.data.current);
            });
        },
        
        newBranch: function(path) {
            var _this   = this;
            path        = this.getPath(path);
            var name    = $('.git_new_branch_area #branch_name').val();
            $.getJSON(this.path + 'controller.php?action=newBranch&path=' + path + '&name=' + name, function(result){
                _this.showDialog('branches', _this.location);
                codiad.message[result.status](result.message);
            });
        },
        
        deleteBranch: function(path) {
            path = this.getPath(path);
            var name = $('#git_branches').val();
            var result = confirm("Are you sure to remove the branch: " + name);
            if (result) {
                $.getJSON(this.path + 'controller.php?action=deleteBranch&path=' + path + '&name=' + name, function(result){
                    codiad.message[result.status](result.message);
                });
            }
            this.showDialog('branches', this.location);
        },
        
        checkoutBranch: function(path) {
            path = this.getPath(path);
            var name = $('#git_branches').val();
            $.getJSON(this.path + 'controller.php?action=checkoutBranch&path=' + path + '&name=' + name, function(result){
                codiad.message[result.status](result.message);
            });
            this.showDialog('overview', this.location);
        },
        
        renameBranch: function(path) {
            path        = this.getPath(path);
            var name    = $('#git_branch').text();
            var newName = $('#git_new_name').val();
            $.getJSON(this.path + 'controller.php?action=renameBranch&path=' + path + '&name=' + name + '&newName=' + newName, function(result){
                codiad.message[result.status](result.message);
            });
            this.showDialog('overview', this.location);
        },
        
        merge: function(path) {
            var _this = this;
            path = this.getPath(path);
            var name = $('#git_branches').val();
            var result = confirm("Are you sure to merge " + name + " into the current branch?");
            if (result) {
                $.getJSON(this.path + 'controller.php?action=merge&path=' + path + '&name=' + name, function(result){
                    codiad.message[result.status](result.message);
                    _this.status(_this.location);
                });
            }
            this.showDialog('overview', this.location);
        },
        
        rename: function(fPath) {
            var _this       = this;
            var path        = _this.dirname(fPath);
            var old_name    = fPath.replace(path, "").substr(1);
            if (old_name.length === 0 || old_name === fPath) {
                //Codiad renaming
                codiad.filemanager.renameNode(fPath);
                return;
            }
            var shortName   = codiad.filemanager.getShortName(fPath);
            var type        = codiad.filemanager.getType(fPath);
            codiad.modal.load(250, codiad.filemanager.dialog, { action: 'rename', path: fPath, short_name: shortName, type: type});
            $('#modal-content form')
                .live('submit', function(e) {
                    e.preventDefault();
                    var newName = $('#modal-content form input[name="object_name"]')
                        .val();
                    // Build new path
                    var arr = fPath.split('/');
                    var temp = [];
                    for (i = 0; i < arr.length - 1; i++) {
                        temp.push(arr[i]);
                    }
                    var newPath = temp.join('/') + '/' + newName;
                    codiad.modal.unload();
                    $.getJSON(_this.path + "controller.php?action=rename&path="+path+"&old_name="+old_name+"&new_name="+newName, function(data) {
                        if (data.status != 'error') {
                            codiad.message.success(type.charAt(0)
                                .toUpperCase() + type.slice(1) + ' Renamed');
                            var node = $('#file-manager a[data-path="' + fPath + '"]');
                            // Change pathing and name for node
                            node.attr('data-path', newPath)
                                .html(newName);
                            if (type == 'file') { // Change icons for file
                                curExtClass = 'ext-' + codiad.filemanager.getExtension(fPath);
                                newExtClass = 'ext-' + codiad.filemanager.getExtension(newPath);
                                $('#file-manager a[data-path="' + newPath + '"]')
                                    .removeClass(curExtClass)
                                    .addClass(newExtClass);
                            } else { // Change pathing on any sub-files/directories
                                codiad.filemanager.repathSubs(path, newPath);
                            }
                            // Change any active files
                            codiad.active.rename(fPath, newPath);
                        } else {
                            codiad.filemanager.renameNode(fPath);
                        }
                    });
                });
        },
        
        numstat: function(path) {
            if (typeof(path) == 'undefined') {
                path = codiad.active.getPath();
            }
            $.getJSON(this.path + 'controller.php?action=numstat&path='+path, function(json){
                var insert = "";
                if (json.status != "error") {
                    var data    = json.data;
                    insert      = '<span class="icon-flow-branch"></span>'+ data.branch + ' +' + data.insertions + ',-' + data.deletions;
                }
                $('#git-stat').html(insert);
            });
        },
        
        login: function(){},
        
        setSettings: function() {
            var _this       = this;
            var username    = $('.git_settings_area #username').val();
            var email       = $('.git_settings_area #email').val();
            $.post(this.path + 'controller.php?action=setSettings', {username: username, email: email}, function(result){
                result = JSON.parse(result);
                codiad.message[result.status](result.message);
                _this.showDialog('overview', _this.location);
            });
        },
        
        getSettings: function() {
            $.getJSON(this.path + 'controller.php?action=getSettings', function(result){
                if (result.status == 'error') {
                    codiad.message.error(result.message);
                    return;
                }
                $('.git_settings_area #username').val(result.data.username);
                $('.git_settings_area #email').val(result.data.email);
            });
        },
        
        /**
         * Get path
         * 
         * @param {string} [path]
         * @result {string} path
         */
        getPath: function(path) {
            if (typeof(path) == 'undefined') {
                return this.location;
            } else {
                return path;
            }
        },
        
        /**
         * Get basename
         * 
         * @param {string} [path]
         * @result {string} basename
         */
        basename: function(path) {
            return path.replace(/\\/g,'/').replace( /.*\//, '' );
        },
        
        /**
         * Get dirname
         * 
         * @param {string} [path]
         * @result {string} dirname
         */
        dirname: function(path) {
            return path.replace(/\\/g,'/').replace(/\/[^\/]*$/, '');
        },
        
        addLine: function(status, name) {
            var line = this.line;
            var element = '<tr><td><input type="checkbox" data-line="'+line+'"></td><td class="'+status.toLowerCase()+'">'+status+'</td><td data-line="'+line+'" class="file">'+name+'</td><td><button class="git_button git_diff" data-line="'+line+'">Diff</button><button class="git_button git_undo" data-line="'+line+'">Undo changes</button></td></tr>';
            $('.git_list tbody').append(element);
            this.line++;
        },
        
        setBranch: function(branch) {
            $('.git_area .branch').text(branch);
        }
    };
})(this, jQuery);