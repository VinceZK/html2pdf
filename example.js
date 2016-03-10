/**
 * Created by VinceZK on 8/17/15.
 */
var phantom = require('phantom-render-stream');
var fs = require('fs');

var render = phantom({
    format      : 'pdf',
//    quality     : 50,
//    retries     : 2,
//    phantomFlags: ['--ignore-ssl-errors=true','--output-encoding=gb2312'],
//    phantomFlags: ['--ignore-ssl-errors=true', '--proxy=127.0.0.1:7070', '--proxy-type=socks5'],
    timeout     : 300000,
//    printMedia  : true
 //   userAgent   : 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36'
});

render('http://c7e56444.i9p.co/forumdisplay.php?fid=19', {
    width       : 1920,
    height      : 1080,
//    pagerSize   : { width: 1920, height: 1080, margin: '0px' },
    paperFormat : 'A4',        // Defaults to A4. Also supported: 'A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid'.
    orientation : 'portrait',  // Defaults to portrait. 'landscape' is also valid
    margin      : '1cm'

}).pipe(fs.createWriteStream('out.pdf'));