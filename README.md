## What is Tailor?

Tailor is a testing and demonstration platform for a pure javascript Git workflow implemented using the open source [git-html5.js](https://github.com/ryanackley/git-html5.js/blob/master/README.md) library. 

It's also a fairly decent code editor. It's a port of the Adobe Brackets code editor to a Chrome packaged app. So, besides Git support, other notable features include  

- Code highlighting for the most popular programming languages.
- Autocomplete for javascript, css, and html.
- Integrated JSLint for javascript.

Tailor is available on the [Chrome web store](https://chrome.google.com/webstore/detail/tailor/mfakmogheanjhlgjhpijkhdjegllgenf). It's also open source and hosted on [github](https://github.com/ryanackley/tailor).

## Git Workflow

Tailor has access to the browser's sandboxed file system via the HTML5 FileSystem api. A user can import a remote Git repository into this sandboxed file system. With some limitations, they can then keep their local sandboxed filesystem and remote git repository in sync. 

### Clone a new project

When you start up Tailor for the first time or if you go to File->New Project, you're given the option to import a Git Repo. 

[Watch a demo on youtube](http://www.youtube.com/GQVbPQo9jO0)

### Commit local changes


After saving some changes in the editor, you can commit these changes to your local git repo.

[Watch a demo on youtube](http://www.youtube.com/umMnD8CUfu4)

### Push local changes to the remote


After making some changes and committing them, you can push these changes to your remote git repo.

[Watch a demo on youtube](http://www.youtube.com/JoyCgLVgdBY)

### Pull remote changes to the local

If someone else makes changes to the git repo, you can pull these changes into your local git repo and working copy. 

[Watch a demo on youtube](http://www.youtube.com/ZiYbD0r24V8)

### Branching


One limitation of git-html5.js is that it only supports fast-forward merging. Therefore, it's possible to get in a situation where you won't be able to push your current branch back to the git repo. In this situation, if you want to push your changes, you'll have to create a local branch, perform a checkout, then push this new branch to your remote git repository. 

[Watch a demo on youtube](http://www.youtube.com/Dh9rmsPrinY)

You could then do a web based merge using your hosting provider or if it's really hairy from the command line.