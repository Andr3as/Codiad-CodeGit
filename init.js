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
		
		path	: curpath,
		location: '',
		line	: 0,
		files	: [],
		
		init: function() {
			var _this = this;
			//Check if directories has git repo
			amplify.subscribe('filemanager.onIndex', function(obj){
				setTimeout(function(){
					$.each(obj.files, function(i, item){
						if ((item.name == obj.path + '/.git') && (item.type == 'directory')) {
							$('.directory[data-path="'+obj.path+'"]').addClass('hasRepo');
						}
					});
				},0);
			});
			//Handle context-menu
			amplify.subscribe('context-menu.onShow', function(obj){
				//Rewrite this, for git diff on file
				if ($('#project-root').hasClass('hasRepo')) {
					//Show git commands - git add, git diff
					$('#context-menu').append('<hr class="both code_git">');
					if ($(obj.e.target).hasClass('directory')) {
						$('#context-menu').append('<a class="directory-only code_git" onclick="codiad.CodeGit.showDialog(\'overview\', $(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Open CodeGit</a>');
					} else {
						$('#context-menu').append('<a class="file-only code_git" onclick="codiad.CodeGit.contextMenuDiff($(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Git Diff</a>');
					}
				} else {
					//Show git init and clone
					if ($(obj.e.target).hasClass('directory')) {
						$('#context-menu').append('<hr class="directory-only code_git">');
						$('#context-menu').append('<a class="directory-only code_git" onclick="codiad.CodeGit.gitInit($(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Git Init</a>');
						$('#context-menu').append('<a class="directory-only code_git" onclick="codiad.CodeGit.clone($(\'#context-menu\').attr(\'data-path\'));"><span class="icon-flow-branch"></span>Git Clone</a>');
					}
				}
			});
			amplify.subscribe("context-menu.onHide", function(){
				$('.code_git').remove();
			});
			//Live features
			$('.git_area #check_all').live("click", function(e){
				if ($('.git_area #check_all').attr("checked") == "checked") {
					$('.git_area input:checkbox').attr("checked", "checked");
				} else {
					$('.git_area input:checkbox').removeAttr("checked");
				}
			});
			//Button Click listener
			$('.git_area .git_diff').live("click", function(e){
				var line = $(this).attr('data-line');
				var path = $('.git_area .git_list .file[data-line="'+line+'"]').text();
				_this.files = [];
				_this.files.push(path);
				_this.showDialog('diff', _this.location);
			});
			$('.git_area .git_undo').live("click", function(e){
				var line = $(this).attr('data-line');
				var path = $('.git_area .git_list .file[data-line="'+line+'"]').text();
				_this.checkout(path, _this.location);
				_this.showDialog('overview', _this.location);
			});
			$('.git_diff_area .git_undo').live("click", function(e){
				_this.checkout(_this.files[0], _this.location);
				_this.showDialog('overview', _this.location);
			});
		},
		
		showDialog: function(type, path) {
			this.location = path || this.location;
			codiad.modal.load(600, this.path + 'dialog.php?action=' + type);
		},
		
		showCommitDialog: function(path) {
			path = this.getPath(path);
			var files = [], line = 0, file = "";
			$('.git_area .git_list input:checkbox[checked="checked"]').each(function(i, item){
				line = $(item).attr('data-line');
				file = $('.git_area .git_list .file[data-line="'+line+'"]').text();
				files.push(file);
			});
			this.files = files;
			this.showDialog('commit', this.location);
		},
		
		gitInit: function(path) {
			$.getJSON(this.path + 'controller.php?action=init&path=' + path, function(result){
				codiad.message[result.status](result.message);
				if (result.status == 'success') {
					$('.directory[data-path="'+path+'"]').addClass('hasRepo');
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
			repo = this.getPath(repo);
			$.getJSON(this.path + 'controller.php?action=diff&repo=' + repo + '&path=' + path, function(result){
				if (result.status == 'error') {
					codiad.message.error(result.message);
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
		
		contextMenuDiff: function(path) {
			var repo		= $('#project-root').attr('data-path');
			this.location   = repo;
			path			= path.replace(repo + "/", "");
			this.files	  = [];
			this.files.push(path);
			this.showDialog('diff', repo);
		},
		
		commit: function(path, msg) {
			var _this = this;
			path = this.getPath(path);
			var message = $('.git_commit_area #commit_msg').val();
			this.showDialog('overview', this.location);
			$.post(this.path + 'controller.php?action=add&path=' + path, {files : JSON.stringify(this.files)}, function(result){
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
						$.post(_this.path + 'controller.php?action=push&path=' + _this.location + '&remote=' + remote + '&branch=' + branch,
							{username: username, password: password}, function(result){
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
				var added, modified, untracked;
				added = result.data.added;
				modified = result.data.modified;
				untracked = result.data.untracked;
				//Add entries
				$.each(added, function(i, item){
					_this.addLine("Added", item);
				});
				$.each(modified, function(i, item){
					_this.addLine("Modified", item);
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
			path		= this.getPath(path);
			var name	= $('.git_new_remote_area #remote_name').val();
			var url	 = $('.git_new_remote_area #remote_url').val();
			$.getJSON(this.path + 'controller.php?action=newRemote&path=' + path + '&name=' + name + '&url=' + url, function(result){
				_this.showDialog('overview', _this.location);
				codiad.message[result.status](result.message);
			});
		},
		
		removeRemote: function(path) {
			var _this   = this;
			path		= this.getPath(path);
			var name	= $('#git_remotes').val();
			var result  = confirm("Are you sure to remove the remote: " + name);
			if (result) {
				$.getJSON(this.path + 'controller.php?action=removeRemote&path=' + path + '&name=' + name, function(result){
					codiad.message[result.status](result.message);
				});
			}
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
			path		= this.getPath(path);
			var name	= $('.git_new_branch_area #branch_name').val();
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
		
		login: function(){},
		
		setSettings: function() {
			var _this	   = this;
			var username	= $('.git_settings_area #username').val();
			var email	   = $('.git_settings_area #email').val();
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