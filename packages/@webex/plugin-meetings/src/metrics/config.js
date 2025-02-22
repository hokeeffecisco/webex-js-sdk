

const errorDescription = {
  UNKNOWN_CALL_FAILURE: 'UnknownCallFailure',
  LOCUS_RATE_LIMITED_INCOMING: 'LocusRateLimitedIncoming',
  LOCUS_RATE_LIMITED_OUTGOING: 'LocusRateLimitedOutgoing',
  LOCUS_UNAVAILABLE: 'LocusUnavailable',
  LOCUS_CONFLICT: 'LocusConflict',
  TIMEOUT: 'Timeout',
  LOCUS_INVALID_SEQUENCE_HASH: 'LocusInvalidSequenceHash',
  UPDATE_MEDIA_FAILED: 'UpdateMediaFailed',
  FAILED_TO_CONNECT_MEDIA: 'FailedToConnectMedia',
  MEDIA_ENGINE_LOST: 'MediaEngineLost',
  MEDIA_CONNECTION_LOST: 'MediaConnectionLost',
  ICE_FAILURE: 'IceFailure',
  MEDIA_ENGINE_HANG: 'MediaEngineHang',
  ICE_SERVER_REJECTED: 'IceServerRejected',
  CALL_FULL: 'CallFull',
  ROOM_TOO_LARGE: 'RoomTooLarge',
  GUEST_ALREADY_ADDED: 'GuestAlreadyAdded',
  LOCUS_USER_NOT_AUTHORISED: 'LocusUserNotAuthorised',
  CLOUDBERRY_UNAVAILABLE: 'CloudberryUnavailable',
  ROOM_TOO_LARGE_FREE_ACCOUNT: 'RoomTooLarge_FreeAccount',
  MEETING_INACTIVE: 'MeetingInactive',
  MEETING_LOCKED: 'MeetingLocked',
  MEETING_TERMINATING: 'MeetingTerminating',
  MODERATOR_PIN_OR_GUEST_REQUIRED: 'Moderator_Pin_Or_Guest_Required',
  MODERATOR_PIN_OR_GUEST_PIN_REQUIRED: 'Moderator_Pin_Or_Guest_PIN_Required',
  MODERATOR_REQUIRED: 'Moderator_Required',
  USER_NOT_MEMBER_OF_ROOM: 'UserNotMemberOfRoom',
  NEW_LOCUS_ERROR: 'NewLocusError',
  NET_WORK_UNAVAILABLE: 'NetworkUnavailable',
  MEETING_UNAVAILABLE: 'MeetingUnavailable',
  MEETING_ID_INVALID: 'MeetingIDInvalid',
  MEETING_SITE_INVALID: 'MeetingSiteInvalid',
  LOCUS_INVALID_JOINTIME: 'LocusInvalidJoinTime',
  LOBBY_EXPIRED: 'LobbyExpired',
  MEDIA_CONNECTION_LOST_PAIRED: 'MediaConnectionLostPaired',
  PHONE_NUMBER_NOT_A_NUMBER: 'PhoneNumberNotANumber',
  PHONE_NUMBER_TOO_LONG: 'PhoneNumberTooLong',
  INVALID_DIALABLE_KEY: 'InvalidDialableKey',
  ONE_ON_ONE_TO_SELF_NOT_ALLOWED: 'OneOnOneToSelfNotAllowed',
  REMOVED_PARTICIPANT: 'RemovedParticipant',
  MEETING_LINK_NOT_FOUND: 'MeetingLinkNotFound',
  PHONE_NUMBER_TOO_SHORT_AFTER_IDD: 'PhoneNumberTooShortAfterIdd',
  INVALID_INVITEE_ADDRESS: 'InvalidInviteeAddress',
  PMR_USER_ACCOUNT_LOCKED_OUT: 'PMRUserAccountLockedOut',
  GUEST_FORBIDDEN: 'GuestForbidden',
  PMR_ACCOUNT_SUSPENDED: 'PMRAccountSuspended',
  EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE: 'EmptyPhoneNumberOrCountryCode',
  CONVERSATION_NOT_FOUND: 'ConversationNotFound',
  SIP_CALLEE_BUSY: 'SIPCalleeBusy',
  SIP_CALLEE_NOT_FOUND: 'SIPCalleeNotFound',
  START_RECORDING_FAILED: 'StartRecordingFailed',
  RECORDING_IN_PROGRESS_FAILED: 'RecordingInProgressFailed'
};

const errorCategory = {
  SIGNALING: 'signaling',
  MEDIA: 'media',
  OTHER: 'other',
  EXPECTED: 'expected'
};

const errorFailureType = {
  CALL_INITIATION_FAILURE: 'CallInitiationFailure',
  MEDIA_CONNECTION_FAILURE: 'MediaConnectionFailure',
  EXPECTED_FAILURE: 'ExpectedFailure',
  ACCESS_RIGHTS: 'AccessRights'
};

export const eventType = {
  // media quality events every 60 seconds
  MEDIA_QUALITY: 'client.mediaquality.event',
  CALL_INITIATED: 'client.call.initiated',
  MERCURY_CONNECTION_LOST: 'client.mercury.connection.lost',
  MERCURY_CONNECTION_RESTORED: 'client.mercury.connection.restored',
  MOVE_MEDIA: 'client.call.move-media',
  LOCAL_SDP_GENERATED: 'client.media-engine.local-sdp-generated',
  REMOTE_SDP_RECEIVED: 'client.media-engine.remote-sdp-received',
  LOCUS_JOIN_REQUEST: 'client.locus.join.request',
  LOCUS_JOIN_RESPONSE: 'client.locus.join.response',
  ALERT_DISPLAYED: 'client.alert.displayed',
  // when ICE negotiation starts
  ICE_START: 'client.ice.start',
  ICE_END: 'client.ice.end',
  ICE_DISCONNECT: 'client.ice.disconnect',
  // Fired when the media engine reports receiving a new media stream. Media events MUST have the mediaType property.
  RECEIVING_MEDIA_START: 'client.media.rx.start',
  // Fired when the media engine reports the end of receiving a media stream.
  // Media events MUST have the mediaType property.
  RECEIVING_MEDIA_STOP: 'client.media.rx.stop',
  // Fired when the media engine reports sending a new media stream. Media events MUST have the mediaType property.
  SENDING_MEDIA_START: 'client.media.tx.start',
  // Fired when the media engine reports it stopped sending a media stream.
  // Media events MUST have the mediaType property.
  SENDING_MEDIA_STOP: 'client.media.tx.stop',
  MEDIA_RENDER_START: 'client.media.render.start',
  MEDIA_RENDER_STOP: 'client.media.render.stop',
  // static media event when outside of the normal scenario
  // call-analyzer assumes that a client is capable of receiving audio, video, and share
  // fired on change, or at beginning of a call
  // every media type is required, so must be indicated with boolean
  MEDIA_CAPABILITIES: 'client.media.capabilities',
  // Sent when the client notices that a media session has been lost
  MEDIA_RECONNECTING: 'client.media.reconnecting',
  // Sent when the client recovers a media session that was lost
  MEDIA_RECOVERED: 'client.media.recovered',
  CALL_ABORTED: 'client.call.aborted',
  // Fired when the "please enter your PIN" or similar prompt is displayed
  // to the user, to authenticate them into the meeting
  PIN_PROMPT: 'client.pin.prompt',
  // Fired when PIN entry has been completed
  PIN_COLLECTED: 'client.pin.collected',
  // Fired when the client displays the native lobby
  LOBBY_ENTERED: 'client.lobby.entered',
  // Fired when the client leaves the native lobby
  LOBBY_EXITED: 'client.lobby.exited',
  // Fired when the user of the client starts a share (e.g. click 'Share' button).
  // This should be sent from all clients that support sending a share.
  SHARE_INITIATED: 'client.share.initiated',
  // Fired when the user stops sharing (usually when they click the 'Stop' button for share)
  SHARE_STOPPED: 'client.share.stopped',
  // When the client receives a successful response from locus indicating that it has the floor for content sharing.
  LOCAL_SHARE_FLOOR_GRANTED: 'client.share.floor-granted.local',
  // Fired when the client changes its local UI/layout to a content sharing view,
  // because it is expecting to display share media.
  SHARE_LAYOUT_DISPLAYED: 'client.share.layout.displayed',
  // Fired when the user of the client starts a whiteboard share (e.g. click 'Share Live' button).
  WHITEBOARD_SHARE_INITIATED: 'client.whiteboard.share.initiated',
  // Fired when the meeting floor is released for whiteboard share
  WHITEBOARD_SHARE_STOPPED: 'client.whiteboard.share.stopped',
  // When the client receives a successful response from locus indicating that it has the floor for whiteboard sharing.
  WHITEBOARD_SHARE_FLOOR_GRANTED: 'client.whiteboard.share.floor-granted',
  MUTED: 'client.muted',
  UNMUTED: 'client.unmuted',
  LEAVE: 'client.call.leave',
  REMOTE_ENDED: 'client.call.remote-ended',
  REMOTE_STARTED: 'client.call.remote-started',
  MEDIA_REQUEST: 'client.locus.media.request',
  MEDIA_RESPONSE: 'client.locus.media.response',
  PSTN_AUDIO_ATTEMPT_START: 'client.pstnaudio.attempt.start',
  PSTN_AUDIO_ATTEMPT_FINISH: 'client.pstnaudio.attempt.finish',
  PSTN_AUDIO_ATTEMPT_SKIP: 'client.pstnaudio.attempt.skip'
};

export const error = {
  name: {
    MEDIA_ENGINE: 'media-engine',
    ICE_FAILED: 'ice.failed',
    LOCUS_RESPONSE: 'locus.response',
    LOCUS_LEAVE: 'locus.leave',
    OTHER: 'other'
  },

  notFatalErrorList: [3003, 3004, 4004, 4005, 4006, 4015],
  errors: {
    // https://sqbu-github.cisco.com/WebExSquared/event-dictionary/wiki/Error-codes-for-metric-events
    // [errorDescription, errorFailureType, errorCategory]
    1000: [errorDescription.UNKNOWN_CALL_FAILURE, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.SIGNALING],
    1001: [errorDescription.LOCUS_RATE_LIMITED_INCOMING,
      errorFailureType.CALL_INITIATION_FAILURE,
      errorCategory.SIGNALING
    ],
    1002: [errorDescription.LOCUS_RATE_LIMITED_OUTGOING,
      errorFailureType.CALL_INITIATION_FAILURE,
      errorCategory.SIGNALING
    ],
    1003: [errorDescription.LOCUS_UNAVAILABLE, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.SIGNALING],
    1004: [errorDescription.LOCUS_CONFLICT, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.SIGNALING],
    1005: [errorDescription.TIMEOUT, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.SIGNALING],
    1006: [errorDescription.LOCUS_INVALID_SEQUENCE_HASH,
      errorFailureType.CALL_INITIATION_FAILURE,
      errorCategory.SIGNALING
    ],
    1007: [errorDescription.UPDATE_MEDIA_FAILED, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.SIGNALING],
    2001: [errorDescription.FAILED_TO_CONNECT_MEDIA,
      errorFailureType.MEDIA_CONNECTION_FAILURE,
      errorCategory.SIGNALING
    ],
    2002: [errorDescription.MEDIA_ENGINE_LOST, errorFailureType.MEDIA_CONNECTION_FAILURE, errorCategory.SIGNALING],
    2003: [errorDescription.MEDIA_CONNECTION_LOST,
      errorFailureType.MEDIA_CONNECTION_FAILURE,
      errorCategory.SIGNALING
    ],
    2004: [errorDescription.ICE_FAILURE, errorFailureType.MEDIA_CONNECTION_FAILURE, errorCategory.SIGNALING],
    2005: [errorDescription.MEDIA_ENGINE_HANG, errorFailureType.MEDIA_CONNECTION_FAILURE, errorCategory.SIGNALING],
    2006: [errorDescription.ICE_SERVER_REJECTED, errorFailureType.MEDIA_CONNECTION_FAILURE, errorCategory.SIGNALING],
    3001: [errorDescription.CALL_FULL, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    3002: [errorDescription.ROOM_TOO_LARGE, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    3004: [errorDescription.GUEST_ALREADY_ADDED, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    3005: [errorDescription.LOCUS_USER_NOT_AUTHORISED, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    3006: [errorDescription.CLOUDBERRY_UNAVAILABLE, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    3007: [errorDescription.ROOM_TOO_LARGE_FREE_ACCOUNT, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4001: [errorDescription.MEETING_INACTIVE, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.EXPECTED],
    4002: [errorDescription.MEETING_LOCKED, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.EXPECTED],
    4003: [errorDescription.MEETING_TERMINATING, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.EXPECTED],
    4004: [errorDescription.MODERATOR_PIN_OR_GUEST_REQUIRED, errorFailureType.ACCESS_RIGHTS, errorCategory.EXPECTED],
    4005: [errorDescription.MODERATOR_PIN_OR_GUEST_PIN_REQUIRED,
      errorFailureType.ACCESS_RIGHTS,
      errorCategory.EXPECTED
    ],
    4006: [errorDescription.MODERATOR_REQUIRED, errorFailureType.ACCESS_RIGHTS, errorCategory.EXPECTED],
    4007: [errorDescription.USER_NOT_MEMBER_OF_ROOM, errorFailureType.ACCESS_RIGHTS, errorCategory.EXPECTED],
    4008: [errorDescription.NEW_LOCUS_ERROR, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.EXPECTED],
    4009: [errorDescription.NET_WORK_UNAVAILABLE, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.EXPECTED],
    4010: [errorDescription.MEETING_UNAVAILABLE, errorFailureType.CALL_INITIATION_FAILURE, errorCategory.EXPECTED],
    4011: [errorDescription.MEETING_ID_INVALID, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4012: [errorDescription.MEETING_SITE_INVALID, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4013: [errorDescription.LOCUS_INVALID_JOINTIME, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4014: [errorDescription.LOBBY_EXPIRED, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4015: [errorDescription.MEDIA_CONNECTION_LOST_PAIRED,
      errorFailureType.MEDIA_CONNECTION_FAILURE,
      errorCategory.EXPECTED
    ],
    4016: [errorDescription.PHONE_NUMBER_NOT_A_NUMBER, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4017: [errorDescription.PHONE_NUMBER_TOO_LONG, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4018: [errorDescription.INVALID_DIALABLE_KEY, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4019: [errorDescription.ONE_ON_ONE_TO_SELF_NOT_ALLOWED,
      errorFailureType.EXPECTED_FAILURE,
      errorCategory.EXPECTED
    ],
    4020: [errorDescription.REMOVED_PARTICIPANT, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4021: [errorDescription.MEETING_LINK_NOT_FOUND, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4022: [errorDescription.PHONE_NUMBER_TOO_SHORT_AFTER_IDD,
      errorFailureType.EXPECTED_FAILURE,
      errorCategory.EXPECTED
    ],
    4023: [errorDescription.INVALID_INVITEE_ADDRESS, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4024: [errorDescription.PMR_USER_ACCOUNT_LOCKED_OUT, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4025: [errorDescription.GUEST_FORBIDDEN, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4026: [errorDescription.PMR_ACCOUNT_SUSPENDED, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4027: [errorDescription.EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE,
      errorFailureType.EXPECTED_FAILURE,
      errorCategory.EXPECTED
    ],
    4028: [errorDescription.CONVERSATION_NOT_FOUND, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4029: [errorDescription.START_RECORDING_FAILED, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    4030: [errorDescription.RECORDING_IN_PROGRESS_FAILED, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    5000: [errorDescription.SIP_CALLEE_BUSY, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED],
    5001: [errorDescription.SIP_CALLEE_NOT_FOUND, errorFailureType.EXPECTED_FAILURE, errorCategory.EXPECTED]
  }
};

export const trigger = {
  USER_INTERACTION: 'user-interaction',
  MERCURY_EVENT: 'mercury-event',
  LOCI_UPDATE: 'loci-update',
  MEDIA_ENGINE_EVENT: 'media-engine-event',
  TIMEOUT: 'timeout',
  SIGNALING: 'signaling',
  OTHER: 'other'
};

export const pstnAudioType = {
  DIAL_IN: 'dial-in',
  DIAL_OUT: 'dial-out'
};

export const displayLocation = {
  TOAST: 'toast',
  ROOM_LIST: 'room-list',
  CALL_PANE: 'call-pane',
  CALL_VIEW: 'call-view',
  OTHER: 'other'
};

export const mediaType = {
  AUDIO: 'audio',
  VIDEO: 'video',
  SHARE: 'share',
  WHITEBOARD: 'whiteboard'
};

export const reconnection = {
  RECOVERED_BY_NEW: 'new', // always set to new due to /media request, no retries with ice restart
  RECOVERED_BY_RETRY: 'retry'
};


export const errorCodes = {
  // ordered by error code values
  USER_CREATE_FAILED: 1400006,
  USER_ALREADY_PARTICIPANT: 1403001,
  CONVO_ALREADY_EXISTS: 1403010,
  ALREADY_ANNOUNCEMENT_SPACE: 1403014,
  NOT_ANNOUNCEMENT_SPACE: 1403015,
  USER_NOT_MODERATOR_IN_ANNOUNCEMENT_SPACE: 1403016,
  TEMP_ID_ALREADY_EXISTS: 1409001,
  PARENT_ACTIVITY_ID_NOT_FOUND_OR_INVALID: 14000015
};
export const statusCodes = {
  // ordered by status codes
  NETWORK_OR_CORS: 0,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409
};

export const errorObjects = {
  category: {
    media: 'media',
    expected: 'expected'
  },
  name: {
    mediaEngine: 'media-engine'
  }
};

export const UNKNOWN = 'unknown';

export const OS_NAME = {
  WINDOWS: 'windows',
  MAC: 'mac',
  IOS: 'ios',
  ANDROID: 'android',
  CHROME: 'chrome',
  LINUX: 'linux',
  OTHERS: 'other'
};

export const CLIENT_NAME = 'webex-js-sdk';
export const PLATFORM = 'Web';
