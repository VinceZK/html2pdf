/**
 * Created by VinceZK on 10/12/14.
 */
var uuid = require('node-uuid');

module.exports = {
    /**
     * Return a time-based upper case UUID with out '-'.
     */
    genTimeBased:function(){
        var timeBasedGuid = uuid.v1();
        return timeBasedGuid.replace(/-/g,"").toUpperCase();
    },

    genRandom:function(){
        var randomGuid = uuid.v4();
        return randomGuid.replace(/-/g,"").toUpperCase();
    }
};