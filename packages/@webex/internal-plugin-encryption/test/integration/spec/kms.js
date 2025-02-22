/* eslint-env browser */
/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-encryption';

import {assert, expect} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';
import {skipInBrowser} from '@webex/test-helper-mocha';

const debug = require('debug')('kms');

describe('Encryption', function () {
  this.timeout(30000);
  describe('KMS', () => {
    let mccoy, webex, spock;

    function str2ab(str) {
      const buf = new ArrayBuffer(str.length);
      const bufView = new Uint8Array(buf);

      for (let i = 0, strLen = str.length; i < strLen; i += 1) {
        bufView[i] = str.charCodeAt(i);
      }

      return buf;
    }

    function arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;

      for (let i = 0; i < len; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }

      return window.btoa(binary);
    }

    before('create test user', () => testUsers.create({count: 2, config: {roles: [{name: 'id_full_admin'}]}})
      .then((users) => {
        spock = users[0];
        webex = new WebexCore({
          credentials: {
            authorization: spock.token
          }
        });
        spock.webex = webex;
        assert.isTrue(webex.canAuthorize);

        mccoy = users[1];
        mccoy.webex = new WebexCore({
          credentials: {
            authorization: mccoy.token
          }
        });

        assert.isTrue(mccoy.webex.canAuthorize);

        return mccoy.webex.internal.device.register();
      }));

    after(() => webex && webex.internal.mercury.disconnect());

    let expiredUser;

    // TODO: Re-enable SPARK-133280
    it.skip('errs using an invalid token', () => testUsers.create({count: 1})
      .then((users) => {
        [expiredUser] = users;
        expiredUser.webex = new WebexCore({
          credentials: {
            authorization: 'invalidToken'
          }
        });
        expiredUser.webex.internal.device.register();
      })
      .then(() => expiredUser.webex.internal.encryption.kms.createUnboundKeys({count: 1}))
      .catch((err) => {
        assert.equal(err.statusCode, 401);
      }));

    describe('#createResource()', () => {
      it('creates a kms resource object', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({
          userIds: [webex.internal.device.userId],
          key
        })
          .then((kro) => {
            assert.property(kro, 'uri');
            assert.property(kro, 'keyUris');
            assert.lengthOf(kro.keyUris, 1);
            assert.include(kro.keyUris, key.uri);
            assert.property(kro, 'authorizationUris');
            assert.lengthOf(kro.authorizationUris, 1);
          })));
    });

    describe('#addAuthorization()', () => {
      let boundedKeyUri, kro, otherKro;

      before('create a resource', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({
          key
        }))
        .then((k) => {
          kro = k;
          boundedKeyUri = kro.keyUris[0];
          assert.lengthOf(kro.authorizationUris, 1);
        }));

      it('authorizes a user to a key', () => webex.internal.encryption.kms.addAuthorization({
        userIds: [mccoy.webex.internal.device.userId],
        kroUri: kro.uri
      })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, mccoy.webex.internal.device.userId);

          return mccoy.webex.internal.encryption.kms.fetchKey({uri: boundedKeyUri});
        }));

      it('authorizes a resource to a key', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({key}))
        .then((k) => {
          otherKro = k;

          return webex.internal.encryption.kms.addAuthorization({
            authIds: [otherKro.uri],
            kro
          });
        })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, otherKro.uri);
        }));
    });

    /**
     *Test listAuthorizations function
     *Setup: Create a resource, then authorize a user to a key, then authorize a resource to a key
     *Test:
     *1)Invoke listAuthorizations on the resource, verify that the function returns the array that contains two authorized items
     *2)Remove the authorized user from the resource, then invoke listAuthorizations again, verify that the returned array doesn't have the user.
     *3)Remove the authorized resource from the resource again, then invoke listAuthorizations again, verify that he returned array doesn't have the resource.
     */
    describe('#listAuthorizations()', () => {
      let boundedKeyUri, kro, otherKro;
      let testResourceId;

      before('creates a resource', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({
          key
        }))
        .then((k) => {
          kro = k;
          boundedKeyUri = kro.keyUris[0];
          assert.lengthOf(kro.authorizationUris, 1);
        }));

      before('authorizes a user to a key', () => webex.internal.encryption.kms.addAuthorization({
        userIds: [mccoy.webex.internal.device.userId],
        kroUri: kro.uri
      })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, mccoy.webex.internal.device.userId);

          return mccoy.webex.internal.encryption.kms.fetchKey({uri: boundedKeyUri});
        }));

      before('authorizes a resource to a key', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({key}))
        .then((k) => {
          otherKro = k;
          testResourceId = otherKro.uri;

          return webex.internal.encryption.kms.addAuthorization({
            authIds: [testResourceId],
            kro
          });
        })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, otherKro.uri);
        }));

      it('list authorizations', () => webex.internal.encryption.kms.listAuthorizations({kroUri: kro.uri})
        .then((authorizations) => {
          assert.equal(authorizations.length, 3);
          assert.include(authorizations.map((a) => a.authId), mccoy.webex.internal.device.userId);
          assert.include(authorizations.map((a) => a.authId), spock.id);
          assert.include(authorizations.map((a) => a.resourceUri), testResourceId);
          assert.include(authorizations.map((a) => a.resourceUri), kro.uri);
        }));

      it('rejects normally for users that are not authorized', () => testUsers.create({count: 1})
        .then(([user]) => {
          const us = new WebexCore({
            credentials: {
              authorization: user.token
            }
          });

          return assert.isRejected(us.internal.encryption.kms.listAuthorizations({kroUri: kro.uri}))
            .then((err) => {
              console.error(err);
              assert.equal(err.status, 403, 'We should get a Not Authorized response from kms');
            })
            .then(() => us.internal.mercury.disconnect());
        }));

      it('remove the user and verify this user is not in the authorization list ', () => webex.internal.encryption.kms.removeAuthorization({
        userId: mccoy.webex.internal.device.userId,
        kroUri: kro.uri
      })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, mccoy.webex.internal.device.userId);

          return webex.internal.encryption.kms.listAuthorizations({kro})
            .then((authorizations) => {
              assert.equal(authorizations.length, 2);
              assert.include(authorizations.map((a) => a.authId), spock.id);
              assert.include(authorizations.map((a) => a.resourceUri), testResourceId);
              assert.include(authorizations.map((a) => a.resourceUri), kro.uri);
            });
        }));

      it('remove the resource and verify this resource is not in the authorizaiton list', () => webex.internal.encryption.kms.removeAuthorization({
        userId: testResourceId,
        kroUri: kro.uri
      })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, testResourceId);

          return webex.internal.encryption.kms.listAuthorizations({kroUri: kro.uri})
            .then((authorizations) => {
              assert.equal(authorizations.length, 1);
              assert.include(authorizations.map((a) => a.authId), spock.id);
              assert.include(authorizations.map((a) => a.resourceUri), kro.uri);
            });
        }));
    });

    describe('#removeAuthorization()', () => {
      let boundedKeyUri, kro, otherKro;

      before('create resource', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({
          key
        }))
        .then((k) => {
          kro = k;
          boundedKeyUri = kro.keyUris[0];
          assert.lengthOf(kro.authorizationUris, 1);
        }));

      before('create another resource', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([key]) => webex.internal.encryption.kms.createResource({
          key
        }))
        .then((k) => {
          otherKro = k;
        }));

      before('add auths to resource', () => webex.internal.encryption.kms.addAuthorization({
        authIds: [otherKro.uri, mccoy.webex.internal.device.userId],
        kro
      })
        .then(([kroAuth, userAuth]) => {
          assert.equal(kroAuth.authId, otherKro.uri);
          assert.equal(userAuth.authId, mccoy.webex.internal.device.userId);
        }));

      it('deauthorizes a user from a key', () => webex.internal.encryption.kms.removeAuthorization({
        userId: mccoy.webex.internal.device.userId,
        kroUri: kro.uri
      })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, mccoy.webex.internal.device.userId);

          return assert.isRejected(mccoy.webex.internal.encryption.kms.fetchKey({uri: boundedKeyUri}));
        }));

      it('deauthorizes a resource from a key', () => webex.internal.encryption.kms.removeAuthorization({
        authId: otherKro.uri,
        kro
      })
        .then(([auth]) => {
          assert.equal(auth.resourceUri, kro.uri);
          assert.equal(auth.authId, otherKro.uri);
        }));
    });

    describe('#bindKey()', () => {
      let key2, kro;

      it('binds a resource to a key', () => webex.internal.encryption.kms.createUnboundKeys({count: 2})
        .then((keys) => {
          key2 = keys[1];

          return webex.internal.encryption.kms.createResource({
            userIds: [webex.internal.device.userId],
            key: keys[0]
          });
        })
        .then((k) => {
          kro = k;

          return webex.internal.encryption.kms.bindKey({kro, key: key2});
        })
        .then((key) => {
          assert.equal(key.uri, key2.uri);
          assert.property(key, 'bindDate');
          assert.property(key, 'resourceUri');
          assert.equal(key.resourceUri, kro.uri);
        }));
    });

    describe('#createUnboundKeys()', () => {
      it('requests unbound keys from the KMS', () => webex.internal.encryption.kms.createUnboundKeys({count: 2})
        .then((keys) => {
          assert.lengthOf(keys, 2);

          const [key1, key2] = keys;

          assert.property(key1, 'uri');
          assert.property(key1, 'jwk');
          assert.property(key2, 'uri');
          assert.property(key2, 'jwk');
        }));
    });

    describe('upload customer master key', () => {
      let uploadedkeyId;

      /* eslint-disable no-unused-expressions */
      skipInBrowser(it)('upload customer master key', () => (webex.internal.encryption.kms.deleteAllCustomerMasterKeys({assignedOrgId: spock.orgId})
        .then(() => webex.internal.encryption.kms.fetchPublicKey({assignedOrgId: spock.orgId}))
        .then((publicKey) => {
          assert.isNotEmpty(publicKey);
          const pemHeader = '-----BEGIN PUBLIC KEY-----';
          const pemFooter = '-----END PUBLIC KEY-----';
          const publicContent = publicKey.substring(pemHeader.length, publicKey.length - pemFooter.length);
          const binaryDerString = window.atob(publicContent);
          // convert from a binary string to an ArrayBuffer
          const binaryDer = str2ab(binaryDerString);

          return window.crypto.subtle.importKey(
            'spki',
            binaryDer,
            {
              name: 'RSA-OAEP',
              hash: 'SHA-256'
            },
            true,
            ['encrypt']
          );
        })
        .then((publicKey) => {
          const buf = window.crypto.getRandomValues(new Uint8Array(16));

          return window.crypto.subtle.encrypt(
            {
              name: 'RSA-OAEP'
            },
            publicKey,
            buf
          );
        })
        .then((encryptedData) => webex.internal.encryption.kms.uploadCustomerMasterKey({assignedOrgId: spock.orgId, customerMasterKey: arrayBufferToBase64(encryptedData)}))
        .then((uploadRes) => {
          uploadedkeyId = uploadRes.customerMasterKeys[0].uri;

          return webex.internal.encryption.kms.listAllCustomerMasterKey({assignedOrgId: spock.orgId});
        })
        .then((listCmksRes) => {
          const cmks = listCmksRes.customerMasterKeys;
          const uploadedCmk = cmks.find((cmk) => cmk.uri === uploadedkeyId);

          expect(uploadedCmk).to.not.be.null;

          return webex.internal.encryption.kms.changeCustomerMasterKeyState({keyId: uploadedkeyId, keyState: 'ACTIVE', assignedOrgId: spock.orgId});
        })
        .then((activeRes) => {
          expect(activeRes.customerMasterKeys[0].usageState).to.have.string('ACTIVE');

          // return webex.internal.encryption.kms.useGlobalMasterKey({assignedOrgId: spock.orgId});
          return webex.internal.encryption.kms.deleteAllCustomerMasterKeys({assignedOrgId: spock.orgId});
        })));
    });

    describe('#fetchKey()', () => {
      let key;

      it('retrieves a specific key', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;

          return webex.internal.encryption.kms.fetchKey({uri: key.uri});
        })
        .then((key2) => {
          assert.property(key2, 'uri');
          assert.property(key2, 'jwk');
          assert.notEqual(key2, key);
          assert.equal(key2.uri, key.uri);
        }));
    });

    describe('#fetchKey(onBehalfOf)', () => {
      let jim;

      before('create compliance officer test user', () => testUsers.create({
        count: 1,
        config: {
          roles: [{name: 'spark.kms_orgagent'}]
        }
      })
        .then((users) => {
          jim = users[0];

          jim.webex = new WebexCore({
            credentials: {
              authorization: jim.token
            }
          });
          assert.isTrue(jim.webex.canAuthorize);
        }));

      before('connect compliance officer to mercury', () => jim.webex.internal.mercury.connect());

      after(() => jim.webex && jim.webex.internal.mercury.disconnect());

      let key;

      it('retrieve key on behalf of another user', () => spock.webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;

          // Compliance Officer Jim fetches a key on behalf of Spock
          return jim.webex.internal.encryption.kms.fetchKey({uri: key.uri, onBehalfOf: spock.id});
        })
        .then((key2) => {
          assert.property(key2, 'uri');
          assert.property(key2, 'jwk');
          assert.notEqual(key2, key);
          assert.equal(key2.uri, key.uri);
        }));

      it('retrieve key on behalf of self', () => jim.webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;

          // Compliance Officer Jim fetches a key on behalf of himself
          // This covers an edge case documented by https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-240862.
          return jim.webex.internal.encryption.kms.fetchKey({uri: key.uri, onBehalfOf: jim.id});
        })
        .then((key2) => {
          assert.property(key2, 'uri');
          assert.property(key2, 'jwk');
          assert.notEqual(key2, key);
          assert.equal(key2.uri, key.uri);
        }));

      // Spock creates the key and Jim is not in the KRO so he should not have access
      it('retrieve key on behalf of self but self does not have access', () => spock.webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;

          // Compliance Officer Jim fetches a key on behalf of himself but he is not in the KRO
          return jim.webex.internal.encryption.kms.fetchKey({uri: key.uri, onBehalfOf: jim.id});
        })
        .then(() => {
          expect.fail('It should not be possible to retrieve a key on behalf of another user without the spark.kms_orgagent role');
        })
        .catch((error) => {
          // Expect a Forbidden error
          expect(error.body.status).to.equal(403);
        }));


      it('error retrieving key, on behalf of another user, without spark.kms_orgagent role',
        () => spock.webex.internal.encryption.kms.createUnboundKeys({count: 1})
          .then(([k]) => {
            key = k;

            // Normal user McCoy fails to fetch a key on behalf of Spock
            return mccoy.webex.internal.encryption.kms.fetchKey({uri: key.uri, onBehalfOf: spock.id});
          })
          .then(() => {
            expect.fail('It should not be possible to retrieve a key on behalf of another user without the spark.kms_orgagent role');
          })
          .catch((error) => {
            // Expect a Forbidden error
            expect(error.body.status).to.equal(403);
          }));

      it('retrieve key on behalf of other users in quick succession', () => {
        let spockKey, mccoyKey;

        return Promise.all([
          spock.webex.internal.encryption.kms.createUnboundKeys({count: 1}),
          mccoy.webex.internal.encryption.kms.createUnboundKeys({count: 1})
        ]).then(([[spockK], [mccoyK]]) => {
          spockKey = spockK;
          mccoyKey = mccoyK;

          // Compliance Officer Jim fetches keys on behalf of users
          return Promise.all([
            jim.webex.internal.encryption.kms.fetchKey({uri: spockKey.uri, onBehalfOf: spock.id}),
            jim.webex.internal.encryption.kms.fetchKey({uri: mccoyKey.uri, onBehalfOf: mccoy.id})
          ]);
        }).then(([spockK, mccoyK]) => {
          assert.property(spockK, 'uri');
          assert.property(spockK, 'jwk');
          assert.notEqual(spockK, spockKey);
          assert.equal(spockK.uri, spockKey.uri);

          assert.property(mccoyK, 'uri');
          assert.property(mccoyK, 'jwk');
          assert.notEqual(mccoyK, mccoyKey);
          assert.equal(mccoyK.uri, mccoyKey.uri);
        });
      });
    });

    describe('#ping()', () => {
      it('sends a ping to the kms', () => webex.internal.encryption.kms.ping()
        .then((res) => {
          assert.property(res, 'status');
          assert.equal(res.status, 200);
          assert.property(res, 'requestId');
        }));
    });

    describe('when ecdhe negotiation times out', () => {
      let originalKmsTimeout, webex2, spy;

      before('create test user', () => testUsers.create({count: 1})
        .then(([u]) => {
          webex2 = new WebexCore({
            credentials: {
              authorization: u.token
            }
          });
          assert.isTrue(webex.canAuthorize);
        }));

      after(() => webex2 && webex2.internal.mercury.disconnect());

      beforeEach('alter config', () => {
        originalKmsTimeout = webex2.config.encryption.kmsInitialTimeout;
        webex2.config.encryption.kmsInitialTimeout = 100;
        spy = sinon.spy(webex2.internal.encryption.kms, 'prepareRequest');
      });

      afterEach(() => {
        webex2.config.encryption.kmsInitialTimeout = originalKmsTimeout;
      });

      afterEach(() => spy.restore());

      it('handles late ecdhe responses', () => webex2.internal.encryption.kms.ping()
        .then(() => {
          // callCount should be at least 3:
          // 1 for the initial ping message
          // 1 when the ecdh key gets renegotiated
          // 1 when the pings gets sent again
          debug(`ecdhe: spy call count: ${spy.callCount}`);
          assert.isAbove(spy.callCount, 2, 'If this test fails, we\'ve made previously-assumed-to-be-impossible performance gains in cloudapps; please update this test accordingly.');
        }));

      describe('when ecdhe is renegotiated', () => {
        let ecdhMaxTimeout;

        before('alter config', () => {
          ecdhMaxTimeout = webex2.config.encryption.ecdhMaxTimeout;
          webex2.config.encryption.ecdhMaxTimeout = 2000;
        });

        after(() => {
          webex2.config.encryption.ecdhMaxTimeout = ecdhMaxTimeout;
        });

        it('limits the number of retries', () => webex2.internal.encryption.kms.ping()
          .then(() => {
            debug(`retry: spy call count: ${spy.callCount}`);
            assert.isBelow(spy.callCount, 5);
          }));
      });
    });

    describe('when the kms is in another org', () => {
      let fedWebex;

      before('create test user in other org', () => testUsers.create({
        count: 1,
        config: {
          email: `webex-js-sdk--kms-fed--${uuid.v4()}@wx2.example.com`,
          entitlements: ['webExSquared'],
          orgId: 'kmsFederation'
        }
      })
        .then((users) => {
          const fedUser = users[0];

          assert.equal(fedUser.orgId, '75dcf6c2-247d-4e3d-a32c-ff3ee28398eb');
          assert.notEqual(fedUser.orgId, spock.orgId);

          fedWebex = new WebexCore({
            credentials: {
              authorization: fedUser.token
            }
          });
          assert.isTrue(fedWebex.canAuthorize);
        }));

      before('connect federated user to mercury', () => fedWebex.internal.mercury.connect());

      after(() => fedWebex && fedWebex.internal.mercury.disconnect());

      it('responds to pings', () => fedWebex.internal.encryption.kms.ping()
        .then((res) => {
          assert.property(res, 'status');
          assert.equal(res.status, 200);
          assert.property(res, 'requestId');
        }));

      let key;

      it('lets federated users retrieve keys from the main org', () => webex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          key = k;

          return webex.internal.encryption.kms.createResource({
            userIds: [
              webex.internal.device.userId,
              fedWebex.internal.device.userId
            ],
            key
          });
        })
        .then(() => fedWebex.internal.encryption.kms.fetchKey({uri: key.uri}))
        .then((fedKey) => assert.equal(fedKey.keyUri, key.keyUri)));

      let fedKey;

      it('lets non-federated users retrieve keys from the federated org', () => fedWebex.internal.encryption.kms.createUnboundKeys({count: 1})
        .then(([k]) => {
          fedKey = k;

          return fedWebex.internal.encryption.kms.createResource({
            userIds: [
              fedWebex.internal.device.userId,
              webex.internal.device.userId
            ],
            key: fedKey
          });
        })
        .then(() => webex.internal.encryption.kms.fetchKey({uri: fedKey.uri}))
        .then((key) => assert.equal(key.keyUri, fedKey.keyUri)));
    });
  });
});
