Contributing to Jison
=======

Fork, make your changes, run tests and/or add tests then send a pull request.

## Running tests

Prerequesites: `node` and `npm`.

First run:

    npm install

Then run tests with:

    make test

## Building the site

To build the site, as well as the Browserified web version of Jison, run:

    make site
    
Then you can also preview the site by doing:

    make preview
    
Note that you will need `nanoc` and `adsf` in order to build/preview the site. `gem install` them if you haven't.

