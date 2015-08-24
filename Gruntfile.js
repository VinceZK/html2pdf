/**
 * Created by VinceZK on 11/21/14.
 */
module.exports = function(grunt){

    // 项目配置
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        uglify: {
            options: {
                mangle: true,
//                compress: true,
                //report: 'gzip',
                maxLineLen:120,
                banner: '/*! <%= pkg.name %>-v<%= pkg.version %>' +
                    '@<%= grunt.template.today("yyyy/mm/dd hh:mm:ss") %> */\n'
            },
            build: {
                files: [
                    {
                        expand: true,
                        cwd: 'app/modules',
                        src: ['**/*.js', '!**/*_test.js'],
                        dest: 'app/build'
                    }
                ]
            }
        },
        concat: {
            options: {
                stripBanners: true
                // Replace all 'use strict' statements in the code with a single one at the top
//                banner: "'use strict';\n",
//                process: function(src, filepath) {
//                    return '// Source: ' + filepath + '\n' +
//                        src.replace(/(^|\n)[ \t]*('use strict'|"use strict");?\s*/g, '$1');
//                }
            },
            build: {
                src: ['app/bower_components/jquery/dist/jquery.min.js',
                    'app/bower_components/angular/angular.min.js',
                    'app/bower_components/angular-bootstrap/ui-bootstrap-tpls.min.js',
                    'app/bower_components/bootstrap/dist/js/bootstrap.min.js',
                    'app/build/snapshot/snapshot.js',
                    'app/build/common/alert.js'],
                dest: 'app/build/snapshot.min.js'
            }
//            dependency: {
//                src: 'app/bower_components/**/*.min.js',
//                dest: 'app/build/dependency.min.js'
//            }
        }
    });

    // 加载提供"uglify"任务的插件
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');

    // 默认任务
    grunt.registerTask('default', ['uglify','concat']);
};