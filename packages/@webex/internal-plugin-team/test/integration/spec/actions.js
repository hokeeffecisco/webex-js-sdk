/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import '@webex/internal-plugin-team';

import {assert} from '@webex/test-helper-chai';
import WebexCore from '@webex/webex-core';
import {find} from 'lodash';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';

describe('plugin-team', () => {
  describe('Team', () => {
    let kirk, spock;

    before(() => testUsers.create({count: 2})
      .then((users) => {
        [kirk, spock] = users;

        kirk.webex = new WebexCore({
          credentials: {
            authorization: kirk.token
          },
          config: {
            conversation: {
              keepEncryptedProperties: true
            }
          }
        });

        spock.webex = new WebexCore({
          credentials: {
            authorization: spock.token
          },
          config: {
            conversation: {
              keepEncryptedProperties: true
            }
          }
        });

        return Promise.all([
          kirk.webex.internal.mercury.connect(),
          spock.webex.internal.mercury.connect()
        ]);
      }));

    after(() => Promise.all([
      kirk && kirk.webex.internal.mercury.disconnect(),
      spock && spock.webex.internal.mercury.disconnect()
    ]));

    describe('#addConversation()', () => {
      let groupConversation, team;

      before(() => {
        const teamPromise = kirk.webex.internal.team.create({
          displayName: `team-${uuid.v4()}`,
          participants: [
            kirk,
            spock
          ]
        });

        const conversation = {
          displayName: `group-conversation-${uuid.v4()}`,
          participants: [
            kirk
          ]
        };

        return Promise.all([
          teamPromise,
          kirk.webex.internal.conversation.create(conversation, {forceGrouped: true})
        ])
          .then(([t, c]) => {
            team = t;
            groupConversation = c;
          });
      });

      it('adds an existing group conversation to a team', () => kirk.webex.internal.team.addConversation(team, groupConversation)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, 'add');
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, groupConversation.id);

          return spock.webex.internal.team.get(team, {includeTeamConversations: true});
        })
        .then((t) => {
          assert.equal(t.conversations.items.length, 2);
          const teamConversation = find(t.conversations.items, {id: groupConversation.id});
          const generalConversation = find(t.conversations.items, {id: t.generalConversationUuid});

          assert.include(teamConversation.tags, 'OPEN');

          // Ensure that spock can decrypt the title of the room now that
          // it's been added to a team he's a member of.
          assert.equal(generalConversation.displayName, team.displayName);
          assert.equal(teamConversation.displayName, groupConversation.displayName);

          return kirk.webex.internal.conversation.get(groupConversation);
        })
        .then((conversation) => {
          assert.isDefined(conversation.team);
          assert.equal(conversation.team.id, team.id);
        }));
    });

    describe('#addMember()', () => {
      let additionalConversation, team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
        .then((res) => {
          team = res;

          return kirk.webex.internal.team.createConversation(team, {
            displayName: `team-conversation-${uuid.v4()}`,
            participants: [
              kirk
            ]
          })
            .then((conversation) => {
              additionalConversation = conversation;
            });
        }));

      it('adds a team member to a team', () => kirk.webex.internal.team.addMember(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, 'add');
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.webex.internal.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          const spockEntry = find(team.teamMembers.items, {id: spock.id});

          assert.isDefined(spockEntry);
          assert.isUndefined(spockEntry.roomProperties);

          // Assert spock can decrypt team and its rooms
          return spock.webex.internal.team.get(team, {
            includeTeamConversations: true
          })
            .then((spockTeam) => {
              assert.isDefined(spockTeam);
              assert.notEqual(spockTeam.displayName, spockTeam.encryptedDisplayName);
              assert.equal(spockTeam.displayName, team.displayName);
              assert.equal(spockTeam.conversations.items.length, 2);

              const spockAddtlConversation = find(spockTeam.conversations.items, {id: additionalConversation.id});

              assert.isDefined(spockAddtlConversation);
              assert.notEqual(spockAddtlConversation.displayName, spockAddtlConversation.encryptedDisplayName);
              assert.equal(spockAddtlConversation.displayName, additionalConversation.displayName);
              assert.include(spockAddtlConversation.tags, 'NOT_JOINED');
            });
        }));
    });

    describe('#assignModerator()', () => {
      let team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
        .then((t) => {
          team = t;
        }));

      it('assigns a team moderator', () => kirk.webex.internal.team.assignModerator(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, 'assignModerator');
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.webex.internal.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          const spockEntry = find(team.teamMembers.items, {id: spock.id});

          assert.isDefined(spockEntry);
          assert.isTrue(spockEntry.roomProperties.isModerator);
        }));
    });

    describe('#archive()', () => {
      let conversation, team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
        .then((t) => {
          team = t;

          return kirk.webex.internal.team.createConversation(team, {
            displayName: `team-conversation-${uuid.v4()}`,
            participants: [
              kirk
            ]
          });
        })
        .then((c) => {
          conversation = c;
        }));

      it('archives a team conversation', () => {
        assert.notInclude(conversation.tags, 'ARCHIVED');
        assert.notInclude(conversation.tags, 'HIDDEN');

        return kirk.webex.internal.team.archive(conversation)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, 'archive');
            assert.equal(activity.target.id, conversation.id);
            assert.equal(activity.object.id, conversation.id);

            return kirk.webex.internal.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            assert.isFalse(t.archived);

            conversation = find(t.conversations.items, {id: conversation.id});
            assert.isDefined(conversation);
            assert.include(conversation.tags, 'ARCHIVED');
            assert.include(conversation.tags, 'HIDDEN');
          });
      });

      it('archives a team', () => {
        assert.isFalse(team.archived);

        return kirk.webex.internal.team.archive(team)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, 'archive');
            assert.equal(activity.target.id, team.id);
            assert.equal(activity.object.id, team.id);

            return kirk.webex.internal.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            assert.isTrue(t.archived);

            const generalConversation = find(t.conversations.items, {id: team.generalConversationUuid});

            assert.isDefined(generalConversation);
            assert.include(generalConversation.tags, 'ARCHIVED');
            assert.include(generalConversation.tags, 'HIDDEN');
          });
      });
    });

    describe('#joinConversation()', () => {
      let conversation, team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
        .then((t) => {
          team = t;

          return kirk.webex.internal.team.createConversation(t, {
            displayName: `team-room-${uuid.v4()}`,
            participants: [kirk]
          });
        })
        .then((c) => {
          conversation = c;
        }));

      it('adds the user to an open team conversation', () => spock.webex.internal.team.joinConversation(team, conversation)
        .then((c) => assert.notInclude(c.tags, 'NOT_JOINED')));
    });

    describe('#removeConversation()', () => {
      let conversation, team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
        .then((t) => {
          team = t;

          return kirk.webex.internal.team.createConversation(t, {
            displayName: `team-room-${uuid.v4()}`,
            participants: [kirk]
          });
        })
        .then((c) => {
          conversation = c;
        }));

      it('removes a team conversation from a team', () => kirk.webex.internal.team.removeConversation(team, conversation)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, 'remove');
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, conversation.id);

          return kirk.webex.internal.team.get(team, {includeTeamConversations: true});
        })
        .then((t) => {
          assert.lengthOf(t.conversations.items, 1);
          assert.isUndefined(find(t.conversations.items, {id: conversation.id}));
        }));
    });

    describe('#removeMember()', () => {
      let team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
        .then((t) => {
          team = t;
        }));

      it('removes a team member from a team', () => kirk.webex.internal.team.removeMember(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, 'leave');
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.webex.internal.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          assert.equal(team.teamMembers.items.length, 1);
          assert.equal(team.teamMembers.items[0].id, kirk.id);
        }));
    });

    describe('#unassignModerator()', () => {
      let team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk,
          spock
        ]
      })
        .then((t) => {
          team = t;

          return kirk.webex.internal.team.assignModerator(team, spock);
        }));

      it('unassigns a team moderator', () => kirk.webex.internal.team.unassignModerator(team, spock)
        .then((activity) => {
          assert.isActivity(activity);
          assert.equal(activity.verb, 'unassignModerator');
          assert.equal(activity.target.id, team.id);
          assert.equal(activity.object.id, spock.id);

          return kirk.webex.internal.team.get(team, {
            includeTeamMembers: true
          });
        })
        .then((team) => {
          const spockEntry = find(team.teamMembers.items, {id: spock.id});

          assert.isDefined(spockEntry);
          assert.isUndefined(spockEntry.roomProperties);
        }));
    });

    describe('#unarchive()', () => {
      let conversation, team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
        .then((t) => {
          team = t;

          return kirk.webex.internal.team.createConversation(team, {
            displayName: `team-conversation-${uuid.v4()}`,
            participants: [
              kirk
            ]
          });
        })
        .then((c) => {
          conversation = c;

          return Promise.all([
            kirk.webex.internal.team.archive(conversation),
            kirk.webex.internal.team.archive(team)
          ]);
        })
        .then(() => kirk.webex.internal.team.get(team, {includeTeamConversations: true}))
        .then((t) => {
          team = t;
          conversation = find(team.conversations.items, {id: conversation.id});
        }));

      it('unarchives a team conversation', () => {
        assert.include(conversation.tags, 'ARCHIVED');
        assert.include(conversation.tags, 'HIDDEN');

        return kirk.webex.internal.team.unarchive(conversation)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, 'unarchive');
            assert.equal(activity.target.id, conversation.id);
            assert.equal(activity.object.id, conversation.id);

            return kirk.webex.internal.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            conversation = find(t.conversations.items, {id: conversation.id});
            assert.isDefined(conversation);
            assert.notInclude(conversation.tags, 'ARCHIVED');
            assert.notInclude(conversation.tags, 'HIDDEN');
          });
      });

      it('unarchives a team', () => {
        assert.isTrue(team.archived);

        return kirk.webex.internal.team.unarchive(team)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, 'unarchive');
            assert.equal(activity.target.id, team.id);
            assert.equal(activity.object.id, team.id);

            return kirk.webex.internal.team.get(team, {includeTeamConversations: true});
          })
          .then((t) => {
            assert.isFalse(t.archived);

            const generalConversation = find(t.conversations.items, {id: team.generalConversationUuid});

            assert.isDefined(generalConversation);
            assert.notInclude(generalConversation.tags, 'ARCHIVED');
            assert.notInclude(generalConversation.tags, 'HIDDEN');
          });
      });
    });

    describe('#update()', () => {
      let team;

      before(() => kirk.webex.internal.team.create({
        displayName: `team-${uuid.v4()}`,
        participants: [
          kirk
        ]
      })
        .then((t) => {
          team = t;
        }));

      it('updates a team displayName', () => {
        const obj = {
          displayName: `updated-team-title-${uuid.v4()}`,
          objectType: 'team'
        };

        return kirk.webex.internal.team.update(team, obj)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, 'update');
            assert.equal(activity.target.id, team.id);
          })
          .then(() => kirk.webex.internal.team.get(team))
          .then((t) => assert.equal(t.displayName, obj.displayName));
      });

      it('updates a team summary', () => {
        const obj = {
          summary: `updated-team-summary-${uuid.v4()}`,
          objectType: 'team'
        };

        return kirk.webex.internal.team.update(team, obj)
          .then((activity) => {
            assert.isActivity(activity);
            assert.equal(activity.verb, 'update');
            assert.equal(activity.target.id, team.id);
          })
          .then(() => kirk.webex.internal.team.get(team))
          .then((t) => assert.equal(t.summary, obj.summary));
      });
    });
  });
});
