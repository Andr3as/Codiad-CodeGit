<?php
/*
 * Copyright (c) Codiad & Andr3as, distributed
 * as-is and without warranty under the MIT License.
 * See http://opensource.org/licenses/MIT for more information. 
 * This information must remain intact.
 */

    class Git {
        
        public $resultArray;
        public $result;
        
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
            chdir($path);
            $result = $this->executeCommand("git add " . $file);
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
                if ($result === 0) {
                    return true;
                }
            }
            return false;
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
            } else {
                return false;
            }
            foreach($this->resultArray as $index => $line) {
                $line = str_replace ("\t", "    ", $line);
                $this->resultArray[$index] = htmlentities($line);
            }
            return $this->resultArray;
        }
        
        public function checkout($repo, $path) {
            if (!is_dir($repo)) return false;
            chdir($repo);
            $result = $this->executeCommand("git checkout -- " . $path);
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
            $command = './shell.sh -s "' . $path . '" -c "git push ' . $remote . ' ' . $branch . '"';
            if (isset($_POST['username'])) {
                $command = $command . ' -u "' . $_POST['username'] . '"';
            }
            if (isset($_POST['password'])) {
                $command = $command . ' -p "' . $_POST['password'] . '"';
            }
            $result = $this->executeCommand($command);
            return $this->parseShellResult($result, "Repository pushed!", "Failed to push repo!");
        }
        
        public function pull($path, $remote, $branch) {
            if (!is_dir($path)) return $this->returnMessage("error", "Wrong path!");
            if (!$this->checkExecutableFile()) {
                return $this->returnMessage("error","Failed to change permissions of shell.sh");
            }
            $command = './shell.sh -s "' . $path . '" -c "git pull ' . $remote . ' ' . $branch . '"';
            if (isset($_POST['username'])) {
                $command = $command . ' -u "' . $_POST['username'] . '"';
            }
            if (isset($_POST['password'])) {
                $command = $command . ' -p "' . $_POST['password'] . '"';
            }
            $result = $this->executeCommand($command);
            return $this->parseShellResult($result, "Repository pulled!", "Failed to pull repo!");
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
        
        private function returnMessage($status, $msg) {
            return '{"status":"' . $status . '","message":"' . $msg . '"}';
        }
        
        private function parseShellResult($result, $success, $error) {
            if ($result === 0) {
                return $this->returnMessage("success", $success);
            } else {
                if ($result === 64) {
                    return $this->returnMessage("error", $this->result);
                } else if ($result == 3 || $result == 4) {
                    return $this->returnMessage("login_required","Login required!");
                } else if ($result == 5) {
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
            $modified = array();
            $untracked = array();
            
            foreach($this->resultArray as $line) {
                $tag = substr($line, 0, 2);
                //Branch
                if (strpos($tag, "##") !== false) {
                    $branch = substr($line, 2);
                }
                //Added
                if (strpos($tag, "A") !== false) {
                    array_push($added, substr($line, 2));
                }
                //Modified
                if (strpos($tag, "M") !== false) {
                    array_push($modified, substr($line, 2));
                }
                //Untracked
                if (strpos($tag, "??") !== false) {
                    array_push($untracked, substr($line, 3));
                }
            }
            //Remove whitespace
            $branch = trim($branch);
            foreach($added as $index => $file) {
                $added[$index] = trim($file);
            }
            foreach($modified as $index => $file) {
                $modified[$index] = trim($file);
            }
            foreach($untracked as $index => $file) {
                $untracked[$index] = trim($file);
            }
            
            return array("branch" => $branch,"added" => $added, "modified" => $modified, "untracked" => $untracked);
        }
        
        private function untrackedDiff($path) {
            $result = array();
            if (is_dir($path)) {
                foreach(scandir($path) as $file) {
                    if ($file == '.' || $file == '..') {
                        continue;
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