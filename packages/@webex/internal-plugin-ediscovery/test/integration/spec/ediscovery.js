import '@webex/internal-plugin-ediscovery';
import ReportRequest from '@webex/internal-plugin-ediscovery/src/report-request';
import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';

describe('internal-plugin-ediscovery', () => {
  let complianceUser;
  const reportId = uuid.v4();
  const containerId = uuid.v4();

  before('create compliance officer test user', () => testUsers.create({
    count: 1,
    config: {
      entitlements: [
        'sparkCompliance',
        'sparkAdmin',
        'spark',
        'squaredCallInitiation',
        'squaredRoomModeration',
        'squaredInviter',
        'webExSquared'
      ],
      scope: 'spark-compliance:ediscovery_report',
      roles: [{name: 'spark.kms_orgagent'}]
    }
  })
    .then((users) => {
      complianceUser = users[0];
      complianceUser.webex = new WebexCore({
        credentials: {
          authorization: complianceUser.token
        }
      });
      assert.isTrue(complianceUser.webex.canAuthorize);
    })
    .catch((error) => {
      assert.isTrue(error);
    })
    .then(() => complianceUser.webex.internal.device.register()));

  describe('Requests connect to ediscovery and return 4xx response', () => {
    it('createReport fails with 400 due to invalid report request', async () => {
      await complianceUser.webex.internal.ediscovery.createReport(new ReportRequest())
        .then(() => {
          assert.fail('Expected error response due to invalid report request');
        })
        .catch((error) => {
          assert.equal(error.statusCode, 400);
          assert.include(error.message, 'Report Request must have at least one Email');
        });
    });

    it('getReports fails with 404 due to no reports for this user', async () => {
      await complianceUser.webex.internal.ediscovery.getReports()
        .then(() => {
          assert.fail('Expected error response due to no reports for user');
        })
        .catch((error) => {
          assert.equal(error.statusCode, 404);
          assert.include(error.message, `No records were found for this compliance officer: ${complianceUser.id}`);
        });
    });

    it('getReport fails with 404 due to invalid report id', async () => {
      await complianceUser.webex.internal.ediscovery.getReport(reportId)
        .then(() => {
          assert.fail('Expected error response due to invalid report id');
        })
        .catch((error) => {
          assert.equal(error.statusCode, 404);
          assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
        });
    });

    it('deleteReport fails with 404 due to invalid report id', async () => {
      await complianceUser.webex.internal.ediscovery.deleteReport(reportId)
        .then(() => {
          assert.fail('Expected error response due to invalid report id');
        })
        .catch((error) => {
          assert.equal(error.statusCode, 404);
          assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
        });
    });

    it('restartReport fails with 404 due to invalid report id', async () => {
      await complianceUser.webex.internal.ediscovery.restartReport(reportId)
        .then(() => {
          assert.fail('Expected error response due to invalid report id');
        })
        .catch((error) => {
          assert.equal(error.statusCode, 404);
          assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
        });
    });

    it('getContent fails with 404 due to invalid report id', async () => {
      await complianceUser.webex.internal.ediscovery.getContent(reportId)
        .then(() => {
          assert.fail('Expected error response due to invalid report id');
        })
        .catch((error) => {
          assert.equal(error.statusCode, 404);
          assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
        });
    });

    it('getClientConfig succeeds', async () => {
      await complianceUser.webex.internal.ediscovery.getClientConfig()
        .then((res) => {
          assert.equal(res.statusCode, 200);
          assert.isNotEmpty(res);
        })
        .catch(() => {
          assert.fail('Expected valid response');
        });
    });

    describe('Requests with url parameter connect to remote ediscovery and return 4xx response', () => {
      const validUrl = `https://ediscovery-intb.wbx2.com/ediscovery/api/v1/reports/${reportId}`;
      const invalidUrl = `https://ediscovery-intz.wbx2.com/ediscovery/api/v1/reports/${reportId}`;

      it('getContent by url succeeds with valid url', async () => {
        await complianceUser.webex.internal.ediscovery.getContent(validUrl)
          .then(() => {
            assert.fail('Expected error response due to invalid report id');
          })
          .catch((error) => {
            assert.equal(error.statusCode, 404);
            assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
          });
      });

      it('getContent by url fails with invalid url', async () => {
        await complianceUser.webex.internal.ediscovery.getContent(invalidUrl)
          .then(() => {
            assert.fail('Expected error response due to invalid url');
          })
          .catch((error) => {
            assert.equal(error.statusCode, 0);
          });
      });

      it('getContentContainer by url succeeds with valid url', async () => {
        await complianceUser.webex.internal.ediscovery.getContentContainer(validUrl)
          .then(() => {
            assert.fail('Expected error response due to invalid report id');
          })
          .catch((error) => {
            assert.equal(error.statusCode, 404);
            assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
          });
      });

      it('getContentContainer by url fails with invalid url', async () => {
        await complianceUser.webex.internal.ediscovery.getContentContainer(invalidUrl)
          .then(() => {
            assert.fail('Expected error response due to invalid url');
          })
          .catch((error) => {
            assert.equal(error.statusCode, 0);
          });
      });

      it('getContentContainerByContainerId by url succeeds with valid url', async () => {
        await complianceUser.webex.internal.ediscovery.getContentContainerByContainerId(validUrl, containerId)
          .then(() => {
            assert.fail('Expected error response due to invalid report id');
          })
          .catch((error) => {
            assert.equal(error.statusCode, 404);
            assert.include(error.message, `Report Record with ID[${reportId}] could not be found`);
          });
      });

      it('getContentContainerByContainerId by url fails with invalid url', async () => {
        await complianceUser.webex.internal.ediscovery.getContentContainerByContainerId(invalidUrl, containerId)
          .then(() => {
            assert.fail('Expected error response due to invalid url');
          })
          .catch((error) => {
            assert.equal(error.statusCode, 0);
          });
      });
    });
  });
});
