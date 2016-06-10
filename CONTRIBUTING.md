Contributing to Jison
=======

Fork, make your changes, run tests and/or add tests then send a pull request.

## Required tools for Development 

- NodeJS
- NPM
- GNU make  (make sure you can run the `make` command from your (bash) shell command line)

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

