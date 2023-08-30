module.exports = {
  login: {
    contactNumber: 'required|string|size:10',
    password: 'required|alpha_num',
  },
  forgotPassword: {
  	email: 'required',
  },
  changePassword: {
    password:'required',
    new_password:'required|min:6',
    confirm_password:'required|same:new_password',
  },
  addOrEditUser: {
    id: 'alpha_num',
    name: 'required|string',
    gender: 'required|in:Male,Female,Others',
    occupation: 'string',
    dateOfBirth: 'required|date',
    dateOfMarriage: 'date',
    contactNumber: 'string|size:10',
  },
  registerPrimaryContactAndUsers: {
    'users.*.isPrimary': 'boolean',
    'users.*.name': 'required|string',
    'users.*.gender': 'required|in:Male,Female,Others',
    'users.*.occupation': 'string',
    'users.*.gotra': 'string',
    'users.*.nativeAddress': 'string',
    'users.*.email': 'string',
    'users.*.dateOfBirth': 'required|date',
    'users.*.dateOfMarriage': 'date',
    'users.*.contactNumber': 'string|size:10',
    'users.*.address': 'string',
    'users.*.isHead': 'boolean',
  },
  editCommonDetails: {
    gotra: 'required|string',
    nativeAddress: 'required|string',
    email: 'required|string',
    address: 'required|string',
    head: 'required|alpha_num',
    primaryContact: 'required|alpha_num',
  },
  approveUser: {
    id: 'alpha_num',
    isApproved: 'boolean',
  },
};
