#!/usr/bin/env bash
# for aws lambda, we need a different jpegoptim than produced on ubuntu
cp bin/jpegoptim.aws node_modules/jpegoptim-bin/vendor/jpegoptim