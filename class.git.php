<?php
/*
 * Copyright (c) Codiad & Andr3as, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information. 
 * This information must remain intact.
 */
   include_once('config.php');

    class Git {
        
        public $resultArray;
        public $result;
        
        function __construct() {
            $log = file_get_contents("config.log");
            foreach(getConfig() as $name => $value) {
                $result = $this->executeCommand("git config " . $name . " " . $value);
                if ($result !== 0) {
                    $log .= "Config failed: " . $name . " " . $value;
                }
            }
            file_put_contents("config.log", $log);
        }
        
        public function init($path) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git init");
            if ($result === 0) {
                return true;
            } else {
                return false;
            }
        }
        
        public function cloneRepo($path, $repo) {
            if (!is_dir($path)) return $this->returnMessage("error", "Wrong path!");
            if (!$this->checkExecutableFile()) {
                return $this->returnMessage("error","Failed to change permissions of shell.sh");
            }
            if (!$this->checkExpectExists()) {
                return $this->returnMessage("error", "Please install expect!");
            }
            $command = './shell.sh -s "' . $path . '" -c "git clone ' . $repo . ' ./"';
            if (isset($_POST['username'])) {
                $command = $command . ' -u "' . $_POST['username'] . '"';
            }
            if (isset($_POST['password'])) {
                $command = $command . ' -p "' . $_POST['password'] . '"';
            }
            $result = $this->executeCommand($command);
            return $this->parseShellResult($result, "Repository cloned!", "Failed to clone repo!");
        }
        
        public function status($path) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git status --branch --porcelain");
            if ($result !== 0) {
                return false;
            }
            return $this->parseGitStatus();
        }
        
        public function add($path, $file) {
            if (!is_dir($path)) return false;
            $cwd = getcwd();
            chdir($path);
            $result = $this->executeCommand("git add --all " . $file);
            chdir($cwd);
            if ($result === 0) {
                return true;
            } else {
                return false;
            }
        }
        
        public function commit($path, $msg) {
            if (!is_dir($path)) return false;
            chdir($path);
            if ($this->setGitSettings()) {
                $result = $this->executeCommand("git commit -m \"" . $msg . "\"");
                return $this->parseShellResult($result, "Changes commited", "Failed to commit changes!");
            }
            return $this->parseShellResult(null, null, "Failed to set settings!");
        }
        
        public function getLog($path) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git log");
            if ($result !== 0) {
                return false;
            }
            return $this->resultArray;
        }
        
        public function diff($repo, $path) {
            if (!is_dir($repo)) return false;
            chdir($repo);
            $result = $this->executeCommand("git status --branch --porcelain");
            if ($result !== 0) {
                return false;
            }
            $status = $this->parseGitStatus();
            if (in_array($path, $status['untracked'])) {
                $this->resultArray = $this->untrackedDiff($path);
            } else if (in_array($path, $status['modified'])) {
                $this->executeCommand('git diff ' . $path);
                array_push($this->resultArray, "\n");
            } else if (in_array($path, $status['added'])) {
                $this->executeCommand('git diff --cached ' . $path);
                array_push($this->resultArray, "\n");
            } else if (in_array($path, $status['renamed'])) {
                $this->executeCommand('git diff ' . $path);
                if ($this->result == "") {
                    $this->executeCommand('git status --branch --porcelain');
                    foreach($this->resultArray as $i => $line) {
                        if (strpos($line,$path) !== false) {
                            $name = substr($line, 2);
                            $this->resultArray = array("Renamed: " . $name . "\n");
                            break;
                        }
                    }
                } else {
                    array_push($this->resultArray, "\n");
                }
            } else if (in_array($path, $status['deleted'])) {
                $this->executeCommand('git diff -- ' . $path);
                array_push($this->resultArray, "\n");
            } else {
                return $this->returnMessage("notice", "No changes!");
            }
            foreach($this->resultArray as $index => $line) {
                $line = str_replace ("\t", "    ", $line);
                $this->resultArray[$index] = htmlentities($line);
            }
            return '{"status":"success","data":'. json_encode($this->resultArray) .'}';
        }
        
        public function checkout($repo, $path) {
            if (!is_dir($repo)) return false;
            chdir($repo);
            $result = $this->executeCommand("git status --branch --porcelain");
            if ($result !== 0) {
                return false;
            }
            $status = $this->parseGitStatus();
            $result = -1;
            if (in_array($path, $status['renamed'])) {
                foreach($this->resultArray as $i => $line) {
                    if (strpos($line,$path) !== false) {
                        $name = substr($line,2,strpos($line,"->") - 2);
                        $result = $this->executeCommand("git mv " . $path . " " . $name);
                        break;
                    }
                }
            } else {
                $result = $this->executeCommand("git checkout -- " . $path);
            }
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function getRemotes($path) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git remote");
            if ($result !== 0) return false;
            $buffer = array();
            foreach ($this->resultArray as $remote) {
                $result = $this->executeCommand("git remote show -n " . $remote);
                $buffer[$remote] = $this->result;
            }
            return $buffer;
        }
        
        public function newRemote($path, $name, $url) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git remote add " . $name . " " . $url);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function removeRemote($path, $name) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git remote rm " . $name);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function renameRemote($path, $name, $newName) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git remote rename " . $name . " " . $newName);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function getBranches($path) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git branch");
            $current = "";
            foreach($this->resultArray as $index => $line) {
                $array[$index] = trim($line);
                if (strpos($line, "* ") === 0) {
                    $current = substr($line, 2);
                    $array[$index] = $current;
                }
            }
            if (count($array) === 0) {
                $result = $this->executeCommand("git status --branch --porcelain");
                if ($result !== 0) {
                    return false;
                }
                $status     = $this->parseGitStatus();
                $array[0]   = $status['branch'];
                $current    = $status['branch'];
            }
            return array("branches" => $array, "current" => $current);
        }
        
        public function newBranch($path, $name) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git branch " . $name);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function deleteBranch($path, $name) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git branch -d " . $name);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function checkoutBranch($path, $name) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git checkout " . $name);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function renameBranch($path, $name, $newName) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git branch -m " . $name . " " . $newName);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function merge($path, $name) {
            if (!is_dir($path)) return false;
            chdir($path);
            $result = $this->executeCommand("git merge " . $name);
            if ($result !== 0) {
                return false;
            } else {
                return true;
            }
        }
        
        public function push($path, $remote, $branch) {
            if (!is_dir($path)) return $this->returnMessage("error", "Wrong path!");
            if (!$this->checkExecutableFile()) {
                return $this->returnMessage("error","Failed to change permissions of shell.sh");
            }
            if (!$this->checkExpectExists()) {
                return $this->returnMessage("error", "Please install expect!");
            }
            $command = './shell.sh -s "' . $path . '" -c "git push ' . $remote . ' ' . $branch . '"';
            if (isset($_POST['username'])) {
                $command = $command . ' -u "' . $_POST['username'] . '"';
            }
            if (isset($_POST['password'])) {
                $command = $command . ' -p "' . $_POST['password'] . '"';
            }
            if (isset($_POST['passphrase'])) {
                $command = $command . ' -k "' . $_POST['passphrase'] . '"';
            }
            $result = $this->executeCommand($command);
            return $this->parseShellResult($result, "Repository pushed!", "Failed to push repo!");
        }
        
        public function pull($path, $remote, $branch) {
            if (!is_dir($path)) return $this->returnMessage("error", "Wrong path!");
            if (!$this->checkExecutableFile()) {
                return $this->returnMessage("error","Failed to change permissions of shell.sh");
            }
            if (!$this->checkExpectExists()) {
                return $this->returnMessage("error", "Please install expect!");
            }
            $command = './shell.sh -s "' . $path . '" -c "git pull ' . $remote . ' ' . $branch . '"';
            if (isset($_POST['username'])) {
                $command = $command . ' -u "' . $_POST['username'] . '"';
            }
            if (isset($_POST['password'])) {
                $command = $command . ' -p "' . $_POST['password'] . '"';
            }
            if (isset($_POST['passphrase'])) {
                $command = $command . ' -k "' . $_POST['passphrase'] . '"';
            }
            $result = $this->executeCommand($command);
            return $this->parseShellResult($result, "Repository pulled!", "Failed to pull repo!");
        }
        
        public function renameItem($path, $old_name, $new_name) {
            if (!is_dir($path)) return false;
            chdir($path);
            if(!file_exists($new_path)){
                $command = "git mv " . $old_name . " " . $new_name;
                $result = $this->executeCommand($command);
                if (strpos($this->result, "fatal: not under version control") !== false) {
                    if (rename($old_name,$new_name)) {
                        return $this->returnMessage("succes", "Renamed");
                    } else {
                        return $this->returnMessage("error", "Could Not Rename");
                    }
                } else {
                    return $this->parseShellResult($result, "Renamed", "Could Not Rename");
                }
            }else{
                return $this->returnMessage("error", "Path Already Exists");
            }
        }
        
        public function numstat($path) {
            if (file_exists($path)) {
                $dirname    = dirname($path);
                $filename   = basename($path);
                chdir($dirname);
                $result = $this->executeCommand("git status --branch --porcelain");
                if ($result !== 0) {
                    return false;
                }
                $status = $this->parseGitStatus();
                $result = -1;
                $plus   = 0;
                $minus  = 0;
                if (in_array($filename, $status['untracked'])) {
                    $file = file_get_contents($filename);
                    $file = explode("\n",$file);
                    $plus = count($file);
                    $minus = 0;
                } else {
                    $command    = "git diff --numstat " . $filename;
                    $result     = $this->executeCommand($command);
                    if ($result === 0) {
                        if ($this->result === "") {
                            $plus   = 0;
                            $minus  = 0;
                        } else {
                            $stats  = explode("\t",$this->result);
                            $plus   = $stats[0];
                            $minus  = $stats[1];
                        }
                    } else {
                        return false;
                    }
                }
                $result = array("status" => "success", "data" => array("branch" => $status['branch'], "insertions" => $plus,"deletions" => $minus));
                echo json_encode($result);
            } else {
                return $this->returnMessage("error", "File Does Not Exist");
            }
        }
        
        public function getSettings() {
            $settings = getJSON(CONFIG, 'config');
            if (empty($settings)) {
                $settings['username']   = $_SESSION['user'];
                $settings['email']      = "";
            }
            return $settings;
        }
        
        private function setGitSettings() {
            $settings = $this->getSettings();
            $result = $this->executeCommand('git config user.name "' . $settings['username'] . '"');
            if ($result !== 0) {
                return false;
            }
            $result = $this->executeCommand('git config user.email ' . $settings['email'] );
            if ($result !== 0) {
                return false;
            }
            return true;
        }
        
        private function checkExecutableFile() {
            if (!is_executable ('shell.sh')) {
                if (!chmod('shell.sh', 0755)) {
                    return false;
                }
            }
            return true;
        }
        
        private function checkExpectExists() {
            if (`which expect`) {
                return true;
            } else {
                return false;
            }
        }
        
        private function returnMessage($status, $msg) {
            return '{"status":"' . $status . '","message":"' . $msg . '"}';
        }
        
        private function parseShellResult($result, $success, $error) {
            if ($result === null) {
                return $error;
            }
            if ($result === 0) {
                return $this->returnMessage("success", $success);
            } else {
                if ($result === 64) {
                    return $this->returnMessage("error", $this->result);
                } else if ($result == 3 || $result == 4) {
                    return $this->returnMessage("login_required","Login required!");
                } else if ($result == 7) {
                    return $this->returnMessage("passphrase_required", "passphrase_required");
                } else {
                    if (strpos($this->result, "fatal: ") !== false) {
                        $error = substr($this->result, strpos($this->result, "fatal: ") + strlen("fatal: "));
                    }
                    return $this->returnMessage("error", $error);
                }
            }
        }
        
        private function executeCommand($cmd) {
            $cmd = escapeshellcmd($cmd);
            exec($cmd. ' 2>&1', $array, $result);
            $this->resultArray = $array;
            $this->getResultString();
            return $result;
        }
        
        private function getResultString() {
            $this->result = implode("<br>", $this->resultArray);
        }
        
        private function parseGitStatus() {
            $branch = "";
            $added = array();
            $deleted = array();
            $modified = array();
            $renamed = array();
            $untracked = array();
            
            foreach($this->resultArray as $line) {
                $tag = substr($line, 0, 2);
                //Branch
                if (strpos($tag, "##") !== false) {
                   $initialCommit = strpos($line, "Initial commit on");
                    if ($initialCommit !== false) {
                        $branch = substr($line, 21);
                    } else {
                        $sPos = strpos($line, " ", 3);
                        $dPos = strpos($line, "...", 3);
                        if ( ($sPos !== false) && ($dPos === false)) {
                            $branch = substr($line, 2, $sPos-2);
                        } else if ($dPos !== false) {
                            $branch = substr($line, 2, $dPos-2);
                        } else {
                            $branch = substr($line, 2);
                        }
                    }
                }
                
                if (strpos($tag, "A") !== false) {
                    //Added
                    array_push($added, substr($line, 2));
                } else if (strpos($tag, "D") !== false) {
                    //Deleted
                    array_push($deleted, substr($line, 2));
                } else if (strpos($tag, "R") !== false) {
                    //Renamed
                    $rPos = strpos($line, "->") + 2;
                    array_push($renamed, substr($line, $rPos));
                } else if (strpos($tag, "M") !== false || strpos($tag, "U") !== false) {
                    //Modified
                    array_push($modified, substr($line, 2));
                } else if (strpos($tag, "??") !== false) {
                    //Untracked
                    array_push($untracked, substr($line, 3));
                }
            }
            //Remove whitespace
            $branch = trim($branch);
            foreach($added as $index => $file) {
                $added[$index] = trim($file);
            }
            foreach($deleted as $index => $file) {
                $deleted[$index] = trim($file);
            }
            foreach($modified as $index => $file) {
                $modified[$index] = trim($file);
            }
            foreach($renamed as $index => $file) {
                $renamed[$index] = trim($file);
            }
            foreach($untracked as $index => $file) {
                $untracked[$index] = trim($file);
            }
            //Delete douple entries
            $buffer = array();
            foreach($added as $file) {
                if (!in_array($file, $modified)) {
                    array_push($buffer, $file);
                }
            }
            $added = $buffer;
            
            return array("branch" => $branch,"added" => $added, "deleted" => $deleted, 
                        "modified" => $modified, "renamed" => $renamed, "untracked" => $untracked);
        }
        
        private function untrackedDiff($path) {
            $result = array();
            if (is_dir($path)) {
                foreach(scandir($path) as $file) {
                    if ($file == '.' || $file == '..') {
                        continue;
                    }
                    if (ereg("/$", $path) === false) {
                        $path .= "/";
                    }
                    $res = $this->untrackedDiff($path . $file);
                    foreach($res as $line) {
                        array_push($result, $line);
                    }
                }
            } else {
                $this->executeCommand('cat ' . $path);
                array_push($result, "+++ ". $path);
                foreach($this->resultArray as $index => $line) {
                    array_push($result, "+" . $line);
                }
                array_push($result, "\n");
            }
            return $result;
        }
    }
?>
