var aws = require('aws-sdk');
var s3 = new aws.S3({ apiVersion: '2006-03-01' });
var imagemin = require('imagemin');
var imageminOptipng = require('imagemin-optipng');
var async = require('async');

var acl = process.env.UPLOAD_ACL || 'public-read';
var uploadBucket = process.env.UPLOAD_BUCKET;
var pngLevel = +process.env.PNG_OPTIM_LEVEL || 7;
var skipSize = +process.env.MAX_FILE_SIZE || -1;

exports.optim = function(event, context, callback) {

  var bucket = event.Records[0].s3.bucket.name;
  var key = event.Records[0].s3.object.key;

  if(!/\.png$/.test(key)){
    console.log('Not a PNG');
    return setImmediate(function(){ callback(null, 'Not a PNG'); });
  }

  key = require('querystring').parse('a=' + key).a;

  console.log('BUCKET: ' + bucket);
  console.log('KEY: ' + key);

  async.waterfall([
    function(cb){
      s3.headObject({ Bucket: bucket, Key: key }, function(err, data) {
        if(err) return cb(err);

        if(data.Metadata && data.Metadata.optimized) {
          console.log('Image is already optimized. Skipping.');
        //  return cb('skip');
        }

        if(data.ContentLength){
          console.log('File size is ' + data.ContentLength + ' bytes');

          if(skipSize !== -1 && data.ContentLength > skipSize){
            console.log('Image is larger than configured threshold. Skipping.');
            return cb('skip');
          }
        }

        cb(null, data);
      });
    },

    function(meta, cb){
      s3.getObject({ Bucket: bucket, Key: key }, function(err, data) {
        if(err) return cb(err);

        console.log('Got object.');
        cb(null, meta, data);
      });
    },

    function(meta, obj, cb){
        imagemin.buffer(obj.Body, {use: [imageminOptipng({optimizationLevel: pngLevel})]}).then(buf => {
            console.log('Optimized! Final file size is ' + buf.length + ' bytes');
            cb(null, meta, obj, buf)
        }).catch(err => {
            callback(err)
        });
    },

    function(meta, obj, body, cb){
      meta.Metadata.optimized = 'yes';

      s3.putObject({
        ACL: acl,
        Bucket: uploadBucket || bucket,
        Key: key,
        Body: body,
        ContentType: obj.ContentType,
        Metadata: meta.Metadata,
        StorageClass: meta.StorageClass
      }, function(err){
        if(err) return cb(err);

        console.log('done!');
        cb();
      });
    }
  ], function(err){
    if(err === 'skip'){
      err = null;
    }
    callback(err);
    console.log(err);
    //context.done(err);
  });
};
