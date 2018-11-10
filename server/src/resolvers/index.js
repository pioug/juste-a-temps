const { Mutation } = require("./Mutation");
const { Post } = require("./Post");
const { Query } = require("./Query");
const { Subscription } = require("./Subscription");
const { User } = require("./User");

const resolvers = {
  Mutation,
  Post,
  Query,
  Subscription,
  User,
};

module.exports = {
  resolvers
};
