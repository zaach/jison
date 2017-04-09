Contributing to Jison
=======

Fork, make your changes, run tests and/or add tests then send a pull request.

## Required tools for Development

- NodeJS
- NPM
- GNU make  (make sure you can run the `make` command from your (bash) shell command line)

When you are working on the Microsoft Windows OS, you can obtain the prerequisite tools
by installing Git-for-Windows **and its Developer SDK**
(as only the latter includes *GNU make*, for example, at the time of writing: April 2017):

- [Git-for-Windows](https://git-for-windows.github.io/)
- [Git-fo-Windows Developer SDK](https://github.com/git-for-windows/build-extra/releases/latest)


## Installing

JISON consists of the main project and a couple of git modules; when you work on JISON itself you MUST install those submodules too:

```
$ git submodule update --init
```

should fetch the submodules listed in this project's `.gitmodules` file and you're good to go!

The next step would be to install the required NPM packages for all modules. `make` to the rescue:

```
$ make prep
```


## Building the app

Simply run `make`; this includes running the unit tests for every module as the app is assembled:

```
$ make
```


## Running tests

Then run tests with:

    make test



## Building the site

To build the site, as well as the Browserified web version of Jison, run:

    make site

Then you can also preview the site by doing:

    make preview

Note that you will need `nanoc` and `adsf` in order to build/preview the site. `gem install` them if you haven't.

> ### Note
>
> The `make site` build command will print a WARNING message when `nanoc` is not available,
> but WILL NOT fail the `site` build task. This behaviour has been specifically chosen to
> allow (pre)release build runs to complete and deliver a new jison revision when everything
> but the web pages has compiled successfully.
>


## Building a new (beta-)release

Bump all packages' versions (revision/build number: the **fourth** number in the SEMVER) by running

	make bump

which will patch all `package.json` files.

You can now run

    make
    make site

to build all files, but when you want to be absolute sure and/or need to update some of the core files using your latest jison compiler, then push jison and all its submodules to github and run

    make superclean

which will nuke 100% of the installed NPM packages, *including* jison's dependency upon *itself*.

Next you must re-install the npm packages, which will fetch these from the repositories:

	make prep

and then execute your regular full-build command:

	make site

When you are happy with the result, you can apply the new (previously bumped) version as a TAG to the current commit (which is not necessarily the commit where you ran `make bump` if you found some stuff to do along the way here ;-) ):

	make git-tag


### Doing all this in one go

You can accomplish all the above (and a few other cleanups and checks along the way) by invoking
the bash shell script:

```
./git-tag-and-bump-and-rebuild.sh
```


---


## TL;DR

Run these commands to bump your version, nuke all installed NPM packages and thus erase any and all dependencies on some older bit of jison; then fetch the latest of the repositories and build all:

	make bump

	make superclean
	make prep
	make site

	make git-tag

---
