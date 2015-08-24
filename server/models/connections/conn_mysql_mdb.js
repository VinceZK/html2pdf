/**
 * Created by VinceZK on 9/16/14.
 */
var debug = require('debug')('html2pdf:conn_mysql_mdb');
var async = require('async');
var mysql = require('mysql');
var pool = mysql.createPool({
    connectionLimit : 10,
    host: 'localhost',
    user: 'nodejs',
    password: 'nodejs',
    database: 'MDB',
    port: 3306
});
//var pool = mysql.createPool({
//    host: '121.40.149.111',
//    user: 'root',
//    password: 'root',
//    database: 'MDB',
//    port: 3306
//});
var tenant_domain = '';
var entities = [];

module.exports = {
    entities: entities,

    pool: pool,

    setTenantDomain: function(tenant){
        tenant_domain = tenant;
    },

    getTenantDomain: function () {
        return tenant_domain;
    },

    loadEntities: function(waitForFinish) {
        if (entities.length > 0) return waitForFinish(null);

        var selectSQL1 = "select * from ENTITY where TENANT_DOMAIN = "
            + pool.escape(tenant_domain);

        pool.query(selectSQL1, function (err, entityRows) {
            if(err)throw err; //Actually, the err cannot be catched outside as the nodejs' async mechanism
            async.map(entityRows, function (entityRow, callback) {
                var entity = {
                    TENANT_DOMAIN: entityRow.TENANT_DOMAIN,
                    ENTITY_ID: entityRow.ENTITY_ID,
                    ENTITY_NAME: entityRow.ENTITY_NAME,
                    ENTITY_DESC: entityRow.ENTITY_DESC,
                    MARSHALL: entityRow.MARSHALL,
                    VERSION_NO: entityRow.VERSION_NO,
                    ATTRIBUTES: [],
                    RELATIONSHIPS: []
                };
                var selectSQL2 = "select * from ATTRIBUTE where TENANT_DOMAIN = "
                    + pool.escape(tenant_domain) + " and RELATION_ID = "
                    + pool.escape(entity.ENTITY_ID);

                var selectSQL3 = "SELECT A.RELATIONSHIP_ID,B.NAME,B.DESCRIPTION,B.TYPE,B.VALID_PERIOD," +
                    "A.INVOLVE_DESC,A.CARDINALITY,A.REC_MAPPING," +
                    "C.INVOLVES_ID AS C_INVOLVES_ID, C.CARDINALITY AS C_CARDINALITY, C.REC_MAPPING AS C_REC_MAPPING" +
                    " from MDB.RELATIONSHIP_INVOLVES as A" +
                    " right join MDB.RELATIONSHIP as B" +
                    " on A.TENANT_DOMAIN = B.TENANT_DOMAIN " +
                    " and A.RELATIONSHIP_ID = B.RELATIONSHIP_ID " +
                    " right join MDB.RELATIONSHIP_INVOLVES as C" +
                    " on A.TENANT_DOMAIN = C.TENANT_DOMAIN " +
                    " and A.RELATIONSHIP_ID = C.RELATIONSHIP_ID " +
                    " and A.INVOLVES_ID != C.INVOLVES_ID"+
                    " WHERE A.TENANT_DOMAIN = " + pool.escape(tenant_domain) +
                    " AND A.INVOLVES_ID = "+ pool.escape(entity.ENTITY_ID);

                pool.query(selectSQL2, function (err, attrRows) {
                    if (err)return callback(err,entity.ENTITY_ID);
                    attrRows.forEach(function(attrRow){
                        entity.ATTRIBUTES.push(attrRow);
                    });
                    pool.query(selectSQL3, function (err, rows1) {
                        if (err)return callback(err,entity.ENTITY_ID);
                        rows1.forEach(function(row1) {
                            var relationship = {};
                            relationship['RELATIONSHIP_ID'] = row1.RELATIONSHIP_ID;
                            relationship['INVOLVE_DESC'] = row1.INVOLVE_DESC;
                            relationship['REC_MAPPING'] = row1.REC_MAPPING;
                            relationship['CARDINALITY'] = row1.CARDINALITY;
                            relationship['RELATIONSHIP_NAME'] = row1.NAME;
                            relationship['RELATIONSHIP_DESC'] = row1.DESCRIPTION;
                            relationship['TYPE'] = row1.TYPE;
                            relationship['VALID_PERIOD'] = row1.VALID_PERIOD;
                            relationship['C_INVOLVES_ID'] = row1.C_INVOLVES_ID;
                            relationship['C_CARDINALITY'] = row1.C_CARDINALITY;
                            relationship['C_REC_MAPPING'] = row1.C_REC_MAPPING;
                            entity.RELATIONSHIPS.push(relationship);
                        });
                        entities.push(entity);
                        callback(null,entity.ENTITY_ID);
                    });
                });
            }, function (err, results) {
                if (err) {
                    debug("Error occurs in loading attributes! \n" +
                          "Error message: %s", err);
                    waitForFinish(err, results);
                }
                waitForFinish(null, "Entities are initialized!" + results);
            });
        })
    },

    executeSQL: function(selectSQL,callback) {
        pool.getConnection(function (err, conn) {
            if (err) {
                debug("mySql POOL ==> %s", err);
                throw("mySql POOL ==> " + err);
            }

            conn.query(selectSQL, function (err, rows) {
                if (err) {
                    debug("mySql Select ==> %s", err);
                    conn.release();
                    return callback(err);
                }
                conn.release();
                callback(null, rows);
            })
        });
    },

    doUpdatesParallel: function(updateSQLs, callback){
        pool.getConnection(function(err, conn){
            if (err) {
                debug("mySql POOL ==> %s", err);
                throw("mySql POOL ==> " + err);
            }
            conn.beginTransaction(function(err){
                if (err) {
                    debug("mySql TRANSACTION error ==> %s", err);
                    throw("mySql TRANSACTION ==> " + err);
                }

                async.map(updateSQLs, function (updateSQL, callback){
                    conn.query(updateSQL, function(err,result){
                        if (err) {
                            debug("mySql Update Error ==> %s", updateSQL);
                            conn.rollback(function(){
                                callback(err, result);
                            });
                            return;
                        }
                        callback(null,  result);
                    })
                },function (err, results) {
                    if (err) {
                        debug("Error occurs in doUpdatesParallel() when executing update SQLs ==> %s", err);
                        conn.release();
                        return callback(err, results);
                    }
                    conn.commit(function(err){
                        if(err){
                            debug("mySql Commit ==> %s",err);
                            conn.rollback(function(){
                                callback(err, results);
                            });
                            conn.release();
                            return;
                        }
                        conn.release();
                        callback(null, results);
                    })
                })
            })
        })
    },

    doUpdatesSeries: function(updateSQLs, callback){
        pool.getConnection(function(err, conn){
            if (err) {
                debug("mySql POOL ==> %s", err);
                throw("mySql POOL ==> " + err);
            }
            conn.beginTransaction(function(err){
                if (err) {
                    debug("mySql TRANSACTION error ==> %s", err);
                    throw("mySql TRANSACTION ==> " + err);
                }

                async.mapSeries(updateSQLs, function (updateSQL, callback){
                    conn.query(updateSQL, function(err,result){
                        if (err) {
                            debug("mySql Update Error ==> %s", updateSQL);
                            conn.rollback(function(){
                                callback(err, result);
                            });
                            return;
                        }
                        callback(null, result);
                    })
                },function (err, results) {
                    if (err) {
                        debug("Error occurs in doUpdatesSeries() when executing update SQLs ==> %s", err);
                        conn.release();
                        return callback(err, results);
                    }
                    conn.commit(function(err){
                        if(err){
                            debug("mySql Commit ==> %s",err);
                            conn.rollback(function(){
                                callback(err, results);
                            });
                            conn.release();
                            return;
                        }
                        conn.release();
                        callback(null, results);
                    })
                })
            })
        })
    },

    closeMDB: function(){
        pool.end(function(err){
            if(err)debug('mysql connection pool closing error: %s',err);
        });
    }
};
