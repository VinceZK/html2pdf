var express = require('express');
var router = express.Router();
var Snapshot = require('./controllers/server_snapshotCtrl.js');

/*
 restful APIs
 */
// Snapshot public APIs.
router.route('/pub/api/snapshot')
    .get(Snapshot.getBatchJobByGuids)
    .post(Snapshot.submitBatchJob)
    .put(Snapshot.addSubscribeEmail);
router.get('/pub/api/snapshot/list',Snapshot.getUnfinishedBatchJobs);

// angular启动页
/*router.use('/sitemap2', function(req, res){
    res.sendFile(__dirname + '/seo/sitemap_google_html2pdf.txt');
});
router.use('/sitemap.txt', function(req, res){
    res.sendFile(__dirname + '/seo/sitemap_google_html2pdf.txt');
});*/
router.use('/robots.txt', function(req, res){
    res.sendFile(__dirname + '/seo/robots.txt');
});
router.use('/baidu-verify-50F30B1382.txt', function(req, res){
    res.sendFile(__dirname + '/seo/baidu-verify-50F30B1382.txt');
});
router.use('/webscan_360_cn.html', function(req, res){
    res.sendFile(__dirname + '/seo/webscan_360_cn.html');
});
router.use('/download*', function(req, res){
    var fragments = req.baseUrl.split('/',3);
    if (fragments.length === 2){
        res.render('snapshot_download');
        return;
    }
    var snapGuid = fragments[2] || null;
    Snapshot.getPageInfo(snapGuid,null,function(err,snapShot){
        if(err){
            res.send(err.msgText).end();
            return;
        }
        res.render('snapshot_download_e',snapShot);
    });
});
//Render the /snapshots/<guid>/<index> pages
router.use('/snapshots/!*', function(req, res){
   var fragments = req.baseUrl.split('/',4);
   if (fragments.length < 3){
       res.status(404).end();
       return;
   }
   var snapGuid = fragments[2] || null;
   var seq = fragments[3] || null;

   if(snapGuid === 'list'){
       if(seq === null || seq == 0){
           seq = 1;
       }else{
           seq = parseInt(seq);
       }
       Snapshot.getPageList(seq,10,function(err,pages){
           if(err){
               res.send('系统错误：'+ err).end();
               return;
           }
           res.render('snapshot_list',pages);
       });
   }else{
       Snapshot.getPageInfo(snapGuid,seq,function(err,snapShot){
           if(err){
               res.send(err.msgText).end();
               return;
           }

           res.render('snapshot_detail',snapShot);
       });
   }

});

router.use('/', function(req, res){
    Snapshot.getLatestPageList(30,function(err,latestPages){
        err?res.render('snapshot',{
            TOTAL_NUM_ITEMS:0,
            snapPages:[]
        }):res.render('snapshot',latestPages);
    });
    res.render('snapshot',{
        TOTAL_NUM_ITEMS:0,
        snapPages:[]
    });
});


module.exports = router;
