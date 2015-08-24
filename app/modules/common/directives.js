/**
 * Created by VinceZK on 9/14/14.
 */
var dkDirectives = angular.module('dkDirectives',['blog','dk-app-error']);

// Define a directive and have it $watch a property/trigger so it knows when to focus the element:
dkDirectives
    .directive('focusMe', function($timeout, $parse) {
    return {
        link: function(scope, element, attrs) {
            var model = $parse(attrs.focusMe);
            scope.$watch(model, function(value) {
                //console.log('value=',value);
                if(value === true) {
                    $timeout(function() {
                        element[0].focus();
                    });
                }
            });
            element.bind('blur', function() {
                //console.log('blur')
                scope.$apply(model.assign(scope, false));
            })
        }
    };
})
.directive('dkNote', ['blog_c','$compile','appError',function(blog_c,$compile,appError){
    var linker = function($scope, $element) {
        $scope.sections = {};
        $scope.imgHead = '../../images/dummyHead.png';
        $scope.currentSection = '0';
        var noteMarkerTemplate;

        blog_c.getNumBlogComments($scope.getBlogRecGuid(),function(data){
            if(!data)return;

            if(data.errorMsg)
                return appError.print(data.errorMsg);

            $scope.allComments = data.groupList;
            noteMarkerTemplate = angular.element('<dk-note-marker></dk-note-marker>');
            var blogEles = $element[0].children;
            angular.forEach(blogEles,function(value, key){
                switch (value.nodeName){
                    case 'UL':
                    case 'OL':
                        var parentKey = key;
                        angular.element(value).attr({sectionID:parentKey});
                        var listItem = value.children;
                        angular.forEach(listItem,function(value, key){
                            var childKey = parentKey + '.' + key;
                            addSideComment(value,childKey,$scope);
                        });
                        break;
                    default:
                        addSideComment(value,key,$scope);
                }
            });
        });

        function addSideComment(element, key, parentScope){
            parentScope.sections[key] =
                $compile(noteMarkerTemplate)(parentScope, function(clonedElement) {
                    var ele = angular.element(element);
                    ele.attr({class:'sc-section', sectionID:key});
                    ele.append(clonedElement);
                });
        }

        $scope.setCurrentSection = function(sectionID){
            $scope.currentSection = sectionID;
        };

        $scope.getCurrentSection = function(){
            return $scope.currentSection;
        }
    };
    return {
        restrict: 'A',
        link: linker
    };
}])
.directive('dkNoteMarker', ['blog_c','appError','$document',function(blog_c,appError,$document){

    var linker = function($scope, $element) {
        var blogContentDIV =  angular.element('div.blog-content');
        var sideCommentDIV = $element.children();
        var commentFormDIV = angular.element(sideCommentDIV[0].children[1].children[2]);
        var addNewCommentDIV = angular.element(sideCommentDIV[0].children[1].children[1]);
        var commentsWrapperMobile = sideCommentDIV[0].children[2];
        var commentListDIV =  commentsWrapperMobile.children[0];
        var commentItemsDIV =  commentListDIV.children[0];

        function closeCurrentSideComment(){
            var currentSection = $scope.getCurrentSection();
            var currSideCommentDIV = $scope.sections[currentSection].children();
            var currCommentFormDIV = angular.element(currSideCommentDIV[0].children[1].children[2]);
            var currAddNewCommentDIV = angular.element(currSideCommentDIV[0].children[1].children[1]);
            currSideCommentDIV.removeClass('active');
            currCommentFormDIV.removeClass('active');
            currAddNewCommentDIV.removeClass('hide');
        }

        $element.parent().on('click',function(event){
            var target = angular.element(event.target);
            if(target.closest('.side-comment').length < 1
                && target.closest('body').length > 0){ //Make sure the mouse is clicked on the right area
                closeCurrentSideComment();
                blogContentDIV.removeClass('side-comments-open');
            }
        });
        commentsWrapperMobile.addEventListener('click',function(event){
            var target = angular.element(event.target);
            if(target.closest('.comment-items').length < 1){
                sideCommentDIV.removeClass('active');
            }
        });

        var KJ,MB,GS,OC,QK,MX,HJ,SH,PW,RD,LX,DN;
        var commentItemsEle = angular.element(commentItemsDIV);
        commentItemsDIV.addEventListener('touchstart',function(event){
            event.preventDefault();
            var commentItem = commentItemsDIV.firstElementChild;
            MB = KJ = 0;
            QK = commentItem.offsetWidth * commentItemsDIV.children.length;
            MX = commentItemsDIV.offsetWidth;
            HJ = -(commentItemsDIV.children.length - 1);
            GS = event.touches[0].pageX;
            OC = event.touches[0].pageY;
            RD = 1;
            DN = +new Date;
            SH = void 0;
            commentItemsEle.css('-webkit-transition','0s');
            commentItemsEle.css('transition','0s');
        });
        commentItemsDIV.addEventListener('touchmove',function(event){
            1 < event.touches.length ||
            (KJ = event.touches[0].pageX - GS,
             MB = event.touches[0].pageY - OC,
             GS = event.touches[0].pageX,
             OC = event.touches[0].pageY,
             "undefined" == typeof SH && (SH = Math.abs(MB) - 20 > Math.abs(KJ)),
             SH || (PW = KJ / RD + E8(this),
             event.preventDefault(),
             RD = 0 === LX && 0 < KJ ? GS / MX + 1.25:LX == HJ && 0 > KJ ? Math.abs(GS) / MX + 1.25 : 1,
             commentItemsEle.css( "-webkit-transform", "translate3d(" + PW + "px,0,0)")));
        });
        commentItemsDIV.addEventListener('touchend',function(){
            if (!SH) {
                var a = 1E3 > +new Date - DN && 2 < Math.abs(KJ)? 0 > KJ? -1 : 1 : 0,
                    b = Math[a ? 0 > KJ ? "ceil" : "floor" : "round"](E8(this) / (QK / commentItemsDIV.children.length)),
                    b = Math.min(b + a, 0),
                    b = Math.max(-(commentItemsDIV.children.length - 1), b);
                F8(b, ".2s");
            }
        });

        function E8(ele){
            var a = ele.style['webkitTransform'].match(/translate3d\(([^,]*)/);
            return (0,window.parseInt)(a ? a[1] : 0, 10);
        }

        function F8(b, c, d) {
            var e = b != LX;
            LX = b;
            PW = b * MX;
            commentItemsEle.css( "-webkit-transition", c);
            commentItemsEle.css( "transition", c);
            commentItemsEle.css( "-webkit-transform", "translate3d(" + PW + "px,0,0)");
            if (e || d) {
                c = b = Math.abs(b);
                d = commentItemsDIV.children;
                if (10 < d.length) {
                    if (e = commentListDIV.getElementsByClassName("slideIndicator-fraction")[0]) {
                        e.innerHTML = c + 1 + " of " + d.length;
                    }
                } else {
                    if (d = commentListDIV.getElementsByClassName("slideIndicators")[0]) {
                        (e = d.getElementsByClassName("is-active")[0]) && angular.element(e).removeClass("is-active"),
                        (e = d.children[c]) && angular.element(e).addClass("is-active");
                    }
                }
                //a.O("slide", b, a);
            }
        };


        $scope.sectionID = $element.parent().attr('sectionID');
        $scope.currComment = {
            SECTION_ID:$scope.sectionID,
            USER: 'Anonymous',
            COMMENT:'',
            blogRecGuid:$scope.getBlogRecGuid()
        };

        $scope.sectionComments = $scope.allComments[$scope.sectionID];
        if ($scope.sectionComments !== undefined){
            sideCommentDIV.addClass('has-comments');
            if($scope.sectionComments.length > 10){
                angular.element(commentListDIV).append('<div class="slideIndicator-fraction">'+
                    '1 of '+$scope.sectionComments.length + '</div>');
            }else{
                angular.element(commentListDIV).append('<ul class="slideIndicators"></ul>');
                var ulEle = angular.element(commentListDIV.children[1]);
                var firstTime = true;
                angular.forEach($scope.sectionComments,function(){
                    if(firstTime){
                        ulEle.append('<li class="slideIndicator is-active"></li>');
                        firstTime = false;
                    }else
                        ulEle.append('<li class="slideIndicator"></li>');
                })

            }
        }else{
            $scope.sectionComments=[];
        }

        $scope.toggleComment = function(){
            if ( $scope.getCurrentSection() !== $scope.sectionID){
                closeCurrentSideComment();
                $scope.setCurrentSection($scope.sectionID);
            }

            if (sideCommentDIV.hasClass('active')){
                $scope.closeSideComment();
            }else{
                if($scope.sectionCommentList === undefined){
                    var commentGuids=[];
                    angular.forEach($scope.sectionComments,function(comment){
                        commentGuids.push(comment.REC_GUID);
                    });
                    blog_c.getBlogComments(commentGuids,function(retData){
                        if(retData === null || retData.errorMsg)
                            $scope.sectionCommentList = [];
                        else
                            $scope.sectionCommentList = retData.comments;
                    })
                }
                $scope.openSideComment();
            }
        };

        $scope.openCommentForm = function(){
            commentFormDIV.addClass('active');
            addNewCommentDIV.addClass('hide');
        };

        $scope.closeCommentForm = function(){
            commentFormDIV.removeClass('active');
            addNewCommentDIV.removeClass('hide');
            if(!sideCommentDIV.hasClass('has-comments')){
                sideCommentDIV.removeClass('active');
                blogContentDIV.removeClass('side-comments-open');
            }
        };

        $scope.postComment = function(){
            blog_c.addBlogComment($scope.currComment,function(err,data){
                if(err){
                    appError.print(err);
                }else {
                    if (data.commentObj){
                        delete data.commentObj['blogRecGuid'];
                        delete data.commentObj['parentRelationship'];
                        $scope.sectionCommentList.push(data.commentObj);
                        $scope.sectionComments.push({VALUE0:$scope.sectionID,REC_GUID:data.commentObj.REC_GUID});
                        $scope.currComment.COMMENT = '';
                        if(!sideCommentDIV.hasClass('has-comments'))sideCommentDIV.addClass('has-comments');
                        $scope.openCommentForm();
                    }
                }
            })
        };

        $scope.closeSideComment = function(){
            commentFormDIV.removeClass('active');
            addNewCommentDIV.removeClass('hide');
            sideCommentDIV.removeClass('active');
            blogContentDIV.removeClass('side-comments-open');
        };

        $scope.openSideComment = function(){
            sideCommentDIV.addClass('active');
            if($document[0].body.clientWidth > 738)
            blogContentDIV.addClass('side-comments-open');
        }
    };

    return {
        restrict: 'E',
        scope:true,
        link:linker,
        templateUrl: '/modules/blogPublish/blog_note_marker.html'
    };
}]);