/**
 * Created by VinceZK on 7/7/15.
 */
'use strict';
var debug = require('debug')('html2pdf/snapshot');
var msg = require('../util/msg.js');
var phantom = require('phantom-render-stream');
var fs = require('fs');
var concat = require('concat-stream');
var ALY = require('aliyun-sdk');
var archiver = require('archiver');
var nodemailer = require('nodemailer');
var http = require('http');
var _ = require('underscore');

/**
 * Default phantom render settings
 */
var render = phantom({
    pool        : 2,
    format      : 'pdf',
    quality     : 50,
    phantomFlags: ['--ignore-ssl-errors=true'],
//    phantomFlags: ['--ignore-ssl-errors=true', '--proxy=127.0.0.1:7070', '--proxy-type=socks5'],
    timeout     : 300000,
    printMedia  : true,
    retries     : 2,
    userAgent   : 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36'
});

/**
 * Aliyun OSS connection settings
 */
var ALY_endpoint = 'http://oss-cn-hangzhou-internal.aliyuncs.com';
if(process.env.IS_RUNNING_ON_LOCAL){
    ALY_endpoint = 'http://oss-cn-hangzhou.aliyuncs.com';
}
var oss = new ALY.OSS({
    "accessKeyId": "ARdIDOkQTC2RQ66h",
    "secretAccessKey": "T9udcTwM3aIl8ivYi3Xsd8mW3ymSmT",
    endpoint: ALY_endpoint,
    apiVersion: '2013-10-15'
});

/**
 * Create a SMTP transporter object
 */
var transporter = nodemailer.createTransport({
    service: 'QQ',
    auth: {
        user: 'html2pdf@foxmail.com',
        pass: 'Html1234'
    }
});

var snapshotMsg = new msg('snapshot');

module.exports = {
    /**
     * create snapshot and zip(compress) them to a stream
     * @param snapGuid
     * @param urls : [url1, url2, url3, .....]
     * @param opts :{format:'jpeg', width:1920, height:1080, quality:100}
     * @param callback(zipStream, snapGuid)
     */
   createSnapshotsFromURLs:function(snapGuid, urls, opts, callback){
       var snapURLs, phantomOpts;
       var zipArchiver = archiver('zip');
       var zipStream = fs.createWriteStream(snapGuid + '.zip');
       zipArchiver.pipe(zipStream);

       (urls.constructor === Array)?snapURLs = urls : snapURLs=[];
       (typeof(opts) === 'object')?phantomOpts=opts:phantomOpts=eval("(" + opts + ")");
       _.each(snapURLs, function(url, index){
           var snapshotName = index + '.' + (phantomOpts?phantomOpts.format || 'pdf':'pdf');
           var pRender = render(url, phantomOpts);
           zipArchiver.append(pRender,{name:snapshotName});
       });

       zipArchiver.finalize();
       callback(zipArchiver,snapGuid);
   },

    /**
     * create a thumbnail of the URL and return some meta information like title, keywords, and description
     * @param url
     * @param opts
     * @param callback
     */
   createThumbnailFromURLs:function(url, opts, callback){
       var phantomOpts;
       (typeof(opts) === 'object')?phantomOpts=opts:phantomOpts=eval("(" + opts + ")");
       phantomOpts.crop = {top:0,left:phantomOpts.width/4,width:phantomOpts.width/2,height:phantomOpts.height/2};
       phantomOpts.zoomFactor = 0.5;
       phantomOpts.format = 'png';
       phantomOpts.pageInfo = true;
       callback(render(url, phantomOpts));
   },

    /**
     * Save the zipStream to Aliyun OSS
     * @param zipStream
     * @param snapGuid
     * @param callback(retData, err)
     */
   saveSnapStream2ALYOSS:function(zipStream, snapGuid, callback){
       var zipName = snapGuid + '.zip';
       zipStream.on('error',function(err){
           fs.unlink(zipName);
           debug("Phantom Render ==> %s", err);
           callback(null, snapshotMsg.reportMsg('PHANTOM_RENDER_ERROR','E',err));
       }).pipe(concat(function(data) {
           var fileSize = data.length;
           oss.putObject({
                   Bucket: 'zklee',
                   Key: 'snapshots/' + zipName,
                   Body: data,
                   AccessControlAllowOrigin: '',
                   ContentType: 'application/zip'
               },
               function (err, retData) {
                   fs.unlink(zipName);

                   if (err) {
                       debug("ALY OSS putObject err ==> %s", err);
                       var errMsg = snapshotMsg.reportMsg('ALY_OSS_UPLOAD_ERROR','E',err);
                   }
                   retData.size = fileSize;
                   callback(retData, errMsg);
               })
       }))
   },

    /**
     * Save thumbnail png to ALY OSS
     * @param pRender
     * @param snapGuid
     * @param seq
     * @param callback
     */
   saveThumbnail2ALYOSS:function(pRender,snapGuid,seq,callback){
       var thumbnailName = snapGuid + '/' + seq + '.png';
       pRender.on('error',function(err){
           debug("Phantom Render ==> %s", err);
           callback(null, snapshotMsg.reportMsg('PHANTOM_RENDER_ERROR','E',err));
       }).pipe(concat(function(data){
           oss.putObject({
                   Bucket: 'zklee',
                   Key: 'thumbnails/' + thumbnailName,
                   Body: data,
                   AccessControlAllowOrigin: '',
                   ContentType: 'image/png'
               },
               function (err, retData) {
                   if (err) {
                       debug("ALY OSS putObject err ==> %s", err);
                       var errMsg = snapshotMsg.reportMsg('ALY_OSS_UPLOAD_ERROR','E',err);
                   }
                   callback(retData,errMsg);
               })
       }))
   },

    /**
     * Post the URLs to Baidu so that crawler can be notified immediately
     * @param urls
     * @param callback
     */
   postUrl2Baidu:function(URLs,callback){
        var postData = URLs.join("\n");
        var options = {
            host: 'data.zz.baidu.com',
            port: 80,
            path: '/urls?site=html2pdf.cn&token=mqrrBZxeuJHImPD5',
            method: 'POST',
            headers: {
                "Content-Type":"text/plain",
                "Content-Length": postData.length
            }
        };

        var req=http.request(options,function(res) {
            var body = '';
            res.on('data', function (chunk) {
                body += chunk;
            }).on('end',function(){
                callback(eval("(" + body + ")"));
            });
        });

        req.write(postData + '\n');
        req.end();
   },

    /**
     * Delete the snapshot on OSS by its snapshot guid.
     * @param snapGuid
     * @param callback(retData, errMsg)
     */
   deleteSnapshotOnOSS:function(snapGuid, callback){
       var zipName = snapGuid + '.zip';
       oss.deleteObject({
               Bucket: 'zklee',
               Key: 'snapshots/' + zipName
           },
           function (err, retData) {

               if (err) {
                   debug("ALY OSS deleteObject err ==> %s", err);
                   var errMsg = snapshotMsg.reportMsg('ALY_OSS_DELETE_OBJECT_ERROR','E');
               }

               callback(retData,errMsg);
           });
   },

    /**
     * send a successful email to the receiptant with download links
     * @param recp
     * @param snapGuid
     * @param callback
     * @param jobDesc
     */
   sendDownloadLink:function(recp,snapGuid,jobDesc,callback){
       var downloadLink = 'http://oss.darkhouse.com.cn/snapshots/' + snapGuid + '.zip';
       var message = {

           // sender info
           from: 'html2pdf <html2pdf@foxmail.com>',

           // Comma separated list of recipients
           to: recp,

           // Subject of the message
           subject: '你提交网页打印作业已经转换完成:'+jobDesc,

           headers: {
               'X-Laziness-level': 1000
           },

           // plaintext body
           text: '谢谢你使用html2pdf.cn，请用以下链接下载你的文档：' + downloadLink,

           // HTML body
           html: '<p>谢谢你使用html2pdf.cn，点击<a href="'+ downloadLink + '">下载</a>便能获取你的文档。</p>' +
               '<p>如果觉得好用请推荐给你的朋友。</p><br><p><a href="http://html2pdf.cn">html2pdf.cn</a></p>'+
               '<p>Powered by <a href="http://darkhouse.com.cn/about">Darkhouse</a></p>'

       };

       transporter.sendMail(message, function(error, info) {
           if (error) {
               debug("Send mail error ==> %s", error.message);
               callback(error);
           }else{
               callback(null, info);
           }
       });
   },

    /**
     * Send a fail email to the receptiant
     * @param recp
     * @param errinfo
     * @param callback
     * @param jobDesc
     */
   sendFailedMail:function(recp,jobDesc,errinfo,callback){
       var message = {

           // sender info
           from: 'html2pdf <html2pdf@foxmail.com>',

           // Comma separated list of recipients
           to: recp,

           // Subject of the message
           subject: '你提交的网页转换作业发生错误啦！'+jobDesc,

           headers: {
               'X-Laziness-level': 1000
           },

           // plaintext body
           text: '很遗憾你的网页在转换过程中发生错误，也许是某些网址无法正确打开。具体错误信息：'+ errinfo,

           // HTML body
           html: '<p>很遗憾你的网页在转换过程中发生错误，也许是某些网址无法正确打开。</p>' +
                 '<p>具体错误信息:<i>' + errinfo+ '</i></p>' +
               '<p>请再尝试一次，如果觉得好请推荐给你的朋友。</p><br><p><a href="http://html2pdf.cn">html2pdf.cn</a></p>'+
               '<p>Powered by <a href="http://darkhouse.com.cn/about">Darkhouse</a></p>'

       };

       transporter.sendMail(message, function(error, info) {
           if (error) {
               debug("Send mail error ==> %s", error.message);
               callback(error);
           }else{
               callback(null, info);
           }
       });
   },

    /**
     * Send a system failure to the administrator
     * @param recp
     * @param errinfo
     */
   sendSysErrorMail:function(recp,errinfo){
        var message = {

            // sender info
            from: 'html2pdf <html2pdf@foxmail.com>',

            // Comma separated list of recipients
            to: recp,

            // Subject of the message
            subject: '快照系统错误！',

            headers: {
                'X-Laziness-level': 1000
            },

            // plaintext body
            text: '快照系统发生如下错误：'+ errinfo,

            // HTML body
            html: '<p>快照系统发生错误！</p>' +
                '<p>具体错误信息:<i>' + errinfo+ '</i></p>' +
                '<br><p><a href="http://html2pdf.cn">html2pdf.cn</a></p>'+
                '<p>Powered by <a href="http://darkhouse.com.cn/about">Darkhouse</a></p>'

        };

        transporter.sendMail(message, function(error, info) {
            if (error) {
                debug("Send mail error ==> %s", error.message);
            }
        });
   }

};