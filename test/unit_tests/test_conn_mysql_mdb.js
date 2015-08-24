/**
 * Created by VinceZK on 10/10/14.
 */
var entityDB = require('../../server/models/connections/conn_mysql_mdb.js');
var _ = require('underscore');

describe('mysql connections tests', function(){
    before('Initialize the MDB meta data', function(done){
        entityDB.setTenantDomain('darkhouse.com');
        entityDB.loadEntities(done);
    });

    describe('#loadEntities()', function(){
        it('should return 4 entities', function(){
            entityDB.entities.length.should.equal(4);
        });

        it('should have the "blog" entity', function(){
            var blogEntity = _.where(entityDB.entities,{ENTITY_ID:'blog'})[0];
            blogEntity.should.be.ok;
            var blogIdAttr = _.where(blogEntity.ATTRIBUTES,{ATTR_NAME: 'ID'})[0];
            blogIdAttr.should.be.ok;
            var blogCommentRelationship = _.where(blogEntity.RELATIONSHIPS,{RELATIONSHIP_ID: 'r_blog_comments'})[0];
            blogCommentRelationship.should.be.ok;
        })
    });

    describe('#executeSQL()', function(){
        it('should return tenant "darkhouse.com"', function(done){
            var selectSQL = "SELECT * FROM TENANTS";
            entityDB.executeSQL(selectSQL, function(err, rows){
                if(err)throw err;
                //assert.equal(rows[0].TENANT_DOMAIN, 'darkhouse.com');
                rows[0].TENANT_DOMAIN.should.equal('darkhouse.com');
                done();
            })
        });

        it('should return "User" entity name', function(done){
            var selectSQL = "SELECT * FROM ENTITY WHERE TENANT_DOMAIN = "
                          + entityDB.pool.escape(entityDB.getTenantDomain())
                          + " AND ENTITY_ID = 'user'";
            entityDB.executeSQL(selectSQL, function(err, rows){
                if(err)throw err;
                rows[0].ENTITY_NAME.should.equal('User');
                done();
            })
        })
    });

    describe('#doUpdatesParallel()', function(){
        var recGuid = '305635FFA99B4CA2800ED393F746227F';
        it("should insert an entry in both ENTITY_INSTANCES and UIX_GUID",function(done){
            var insertSQLs = [];
            var insertSQL = "INSERT INTO ENTITY_INSTANCES VALUES ("
                            + entityDB.pool.escape(entityDB.getTenantDomain())
                            + ", 'blog', "
                            + entityDB.pool.escape(recGuid)
                            + ", null ,"
                            + "'1')";
            insertSQLs.push(_.clone(insertSQL));
            insertSQL = "INSERT INTO UIX_5299ED5694B542DF9FBC9EBDF19D3D15 (`REC_GUID`) VALUES (" +
                        entityDB.pool.escape(recGuid) + ")";
            insertSQLs.push(_.clone(insertSQL));

            entityDB.doUpdatesParallel(insertSQLs, function(err, results){
                (err === null).should.be.true;
                results.length.should.equal(2);
                done();
            });
        });

        it("should return duplicate error",function(done){
            var insertSQLs = [];
            var insertSQL = "INSERT INTO ENTITY_INSTANCES VALUES ("
                + entityDB.pool.escape(entityDB.getTenantDomain())
                + ", 'blog', "
                + entityDB.pool.escape(recGuid)
                + ", null ,"
                + "'1')";
            insertSQLs.push(_.clone(insertSQL));
            insertSQL = "INSERT INTO UIX_5299ED5694B542DF9FBC9EBDF19D3D15 (`REC_GUID`) VALUES (" +
                entityDB.pool.escape(recGuid) + ")";
            insertSQLs.push(_.clone(insertSQL));

            entityDB.doUpdatesParallel(insertSQLs, function(err, results){
                (err !== null).should.be.true;
                err.code.should.equal('ER_DUP_ENTRY');
                done();
            });
        });

        it("should update DEL flag to 1",function(done){
            var updateSQLs = [];
            var updateSQL = "UPDATE ENTITY_INSTANCES SET DEL ='1' " +
                "WHERE TENANT_DOMAIN = " + entityDB.pool.escape(entityDB.getTenantDomain()) +
                " AND ENTITY_ID ='blog' AND REC_GUID = " + entityDB.pool.escape(recGuid);
            updateSQLs.push(_.clone(updateSQL));

            entityDB.doUpdatesParallel(updateSQLs, function(err, results){
                (err === null).should.be.true;
                results.length.should.equal(1);
                done();
            });
        });

        it("should have the ENTITY_INSTANCES.DEL = 1",function(done){
            var selectSQL = "SELECT * FROM ENTITY_INSTANCES WHERE TENANT_DOMAIN = "
                + entityDB.pool.escape(entityDB.getTenantDomain())
                + " AND ENTITY_ID = 'blog' AND REC_GUID = "
                + entityDB.pool.escape(recGuid);

            entityDB.executeSQL(selectSQL, function(err, rows){
                if(err)throw err;
                rows[0].DEL.should.equal(1);
                done();
            })
        });

        it("should delete the entry in both the 2 tables",function(done){
            var delSQLs = [];
            var delSQL = "DELETE FROM ENTITY_INSTANCES "+
                "WHERE TENANT_DOMAIN = " + entityDB.pool.escape(entityDB.getTenantDomain()) +
                " AND ENTITY_ID ='blog' and REC_GUID = " + entityDB.pool.escape(recGuid);
            delSQLs.push(_.clone(delSQL));
            delSQL = "DELETE FROM UIX_5299ED5694B542DF9FBC9EBDF19D3D15 "+
                     "WHERE REC_GUID = " + entityDB.pool.escape(recGuid);
            delSQLs.push(_.clone(delSQL));

            entityDB.doUpdatesParallel(delSQLs, function(err, results){
                (err === null).should.be.true;
                results.length.should.equal(2);
                done();
            });
        })
    });

    describe('#doUpdatesSerious()', function (){
        var recGuid = '93D75A540EF04ACF91D7A89BE05A79DF';
        it("should insert an entry first in ENTITY_INSTANCES, then in UIX_GUID", function(done){
            var insertSQLs = [];
            var insertSQL = "INSERT INTO ENTITY_INSTANCES VALUES ("
                        + entityDB.pool.escape(entityDB.getTenantDomain())
                        + ", 'blog', "
                        + entityDB.pool.escape(recGuid)
                        + ", null ,"
                        + "'1')";
            insertSQLs.push(_.clone(insertSQL));
            insertSQL = "INSERT INTO UIX_5299ED5694B542DF9FBC9EBDF19D3D15 (`REC_GUID`) VALUES (" +
                entityDB.pool.escape(recGuid) + ")";
            insertSQLs.push(_.clone(insertSQL));

            entityDB.doUpdatesSeries(insertSQLs, function(err, results){
                (err === null).should.be.true;
                results.length.should.equal(2);
                results[1].should.have.property('insertId');
                results[1].insertId.should.be.above(0);
                done();
            });
        });

        it("should delete the entry in both the 2 tables",function(done){
            var delSQLs = [];
            var delSQL = "DELETE FROM ENTITY_INSTANCES "+
                "WHERE TENANT_DOMAIN = " + entityDB.pool.escape(entityDB.getTenantDomain()) +
                " AND ENTITY_ID ='blog' and REC_GUID = " + entityDB.pool.escape(recGuid);
            delSQLs.push(_.clone(delSQL));
            delSQL = "DELETE FROM UIX_5299ED5694B542DF9FBC9EBDF19D3D15 "+
                "WHERE REC_GUID = " + entityDB.pool.escape(recGuid);
            delSQLs.push(_.clone(delSQL));

            entityDB.doUpdatesParallel(delSQLs, function(err, results){
                (err === null).should.be.true;
                results.length.should.equal(2);
                done();
            });
        })
    })
});
