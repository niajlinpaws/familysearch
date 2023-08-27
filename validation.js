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
    name: 'required|string',
    gender: 'required|in:Male,Female',
    occupation: 'string',
    dateOfBirth: 'required|date',
    dateOfMarriage: 'date',
    contactNumber: 'string|size:10',
    address: 'required|string',
    head: 'alpha_num',
  },
  registerPrimaryContactAndUsers: {
    'users.*.isPrimary': 'boolean',
    'users.*.name': 'required|string',
    'users.*.gender': 'required|in:Male,Female',
    'users.*.occupation': 'string',
    'users.*.gotra': 'string',
    'users.*.dateOfBirth': 'required|date',
    'users.*.dateOfMarriage': 'date',
    'users.*.contactNumber': 'string|size:10',
    'users.*.address': 'required|string',
    'users.*.isHead': 'boolean',
  },
  approveUser: {
    id: 'alpha_num',
    isApproved: 'boolean',
  },
};
