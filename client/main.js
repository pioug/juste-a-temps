import { ApolloClient } from "apollo-client";
import { ApolloLink, Observable, split } from "apollo-link";
import { ApolloProvider, Mutation, Subscription, Query } from "react-apollo";
import { Formik, Form, Field } from "formik";
import { HttpLink } from "apollo-link-http";
import { InMemoryCache } from "apollo-cache-inmemory";
import { onError } from "apollo-link-error";
import { WebSocketLink } from "apollo-link-ws";
import { withClientState } from "apollo-link-state";
import { getMainDefinition } from "apollo-utilities";

import {
  BrowserRouter as Router,
  Redirect,
  Route,
  NavLink
} from "react-router-dom";
import gql from "graphql-tag";
import React from "react";
import ReactDOM from "react-dom";

let bearerToken = localStorage.token;

const request = async operation => {
  const headers = {
    Authorization: `Bearer ${bearerToken}`
  };
  operation.setContext({ headers });
};

const wsLink = new WebSocketLink({
  uri: `ws://localhost:4000/`,
  options: {
    reconnect: true
  }
});

const httpLink = new HttpLink({
  uri: "http://localhost:4000/",
  credentials: "same-origin"
});

const link = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  httpLink
);

const requestLink = new ApolloLink(
  (operation, forward) =>
    new Observable(observer => {
      let handle;
      Promise.resolve(operation)
        .then(oper => request(oper))
        .then(() => {
          handle = forward(operation).subscribe({
            next: observer.next.bind(observer),
            error: observer.error.bind(observer),
            complete: observer.complete.bind(observer)
          });
        })
        .catch(observer.error.bind(observer));

      return () => {
        if (handle) handle.unsubscribe();
      };
    })
);

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.from([requestLink, link])
});

const SIGN_UP = gql`
  mutation signup($name: String!, $email: String!, $password: String!) {
    signup(name: $name, email: $email, password: $password) {
      token
    }
  }
`;

const LOG_IN = gql`
  mutation login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
    }
  }
`;

const GET_ME = gql`
  query me {
    me {
      id
      email
      name
      createdAt
    }
  }
`;

const GET_POSTS = gql`
  query feed {
    feed {
      id
      author {
        name
        email
      }
      title
      updatedAt
      createdAt
    }
  }
`;

const FEED = gql`
  subscription onPostAdded {
    post {
      id
      title
      content
    }
  }
`;

class Home extends React.Component {
  render() {
    return (
      <div>
        {
          <Subscription subscription={FEED}>
            {({ data: { post = {} } = {}, loading }) => (
              <h4>New comment: {!loading && post.id}</h4>
            )}
          </Subscription>
        }
        <Query query={GET_POSTS}>
          {({ client, loading, data: { feed = [] } = {} }) => (
            <pre>{JSON.stringify(feed, null, 2)}</pre>
          )}
        </Query>
      </div>
    );
  }
}

class Login extends React.Component {
  render() {
    return (
      <div>
        <Mutation
          mutation={LOG_IN}
          update={(
            cache,
            {
              data: {
                login: { token }
              }
            }
          ) => {
            bearerToken = localStorage.token = token;
            client.resetStore();
          }}
        >
          {login => (
            <Formik
              initialValues={{
                email: "",
                password: ""
              }}
              onSubmit={values => {
                login({ variables: values });
              }}
            >
              {({ errors, touched, isValidating }) => (
                <Form>
                  <Field
                    name="email"
                    validate={validateEmail}
                    placeholder="Email"
                  />
                  {errors.email && touched.email && <div>{errors.email}</div>}
                  <Field
                    name="password"
                    validate={validatePassword}
                    placeholder="Password"
                    type="password"
                  />
                  {errors.password &&
                    touched.password && <div>{errors.password}</div>}
                  <button type="submit">Log in</button>
                </Form>
              )}
            </Formik>
          )}
        </Mutation>
      </div>
    );
  }
}

function validateEmail(value) {
  let error;
  if (!value) {
    error = "Required";
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(value)) {
    error = "Invalid email address";
  }
  return error;
}

function validatePassword(value) {
  let error;
  if (value === "password") {
    error = "Nice try!";
  }
  return error;
}

class Signup extends React.Component {
  render() {
    return (
      <div>
        <Mutation
          mutation={SIGN_UP}
          update={(
            cache,
            {
              data: {
                signup: { token }
              }
            }
          ) => {
            bearerToken = localStorage.token = token;
            client.resetStore();
          }}
        >
          {signUp => (
            <Formik
              initialValues={{
                name: "",
                email: "",
                password: ""
              }}
              onSubmit={values => {
                signUp({ variables: values });
              }}
            >
              {({ errors, touched, isValidating }) => (
                <Form>
                  <Field
                    name="name"
                    validate={validatePassword}
                    placeholder="Name"
                  />
                  {errors.name && touched.name && <div>{errors.name}</div>}
                  <Field
                    name="email"
                    validate={validateEmail}
                    placeholder="Email"
                  />
                  {errors.email && touched.email && <div>{errors.email}</div>}
                  <Field
                    name="password"
                    validate={validatePassword}
                    placeholder="Password"
                    type="password"
                  />
                  {errors.password &&
                    touched.password && <div>{errors.password}</div>}
                  <button type="submit">Sign up</button>
                </Form>
              )}
            </Formik>
          )}
        </Mutation>
      </div>
    );
  }
}

const GET_DRAFTS = gql`
  query drafts {
    drafts {
      id
      title
      content
    }
  }
`;

const CREATE_DRAFT = gql`
  mutation createDraft(
    $title: String!
    $content: String!
    $authorEmail: String!
  ) {
    createDraft(title: $title, content: $content, authorEmail: $authorEmail) {
      id
      createdAt
      updatedAt
      isPublished
      title
      content
      author {
        id
        email
      }
    }
  }
`;

const DELETE_POST = gql`
  mutation deletePost($id: ID!) {
    deletePost(id: $id) {
      id
    }
  }
`;

const PUBLISH = gql`
  mutation publish($id: ID!) {
    publish(id: $id) {
      id
    }
  }
`;

class Me extends React.Component {
  render() {
    return (
      <div>
        <aside>
          <Mutation mutation={CREATE_DRAFT}>
            {createDraft => (
              <button
                onClick={() =>
                  createDraft({
                    variables: {
                      title: "Draft",
                      content: "Voici quelques mots...",
                      authorEmail: "gilles.piou@gmail.com"
                    }
                  })
                }
              >
                Create draft
              </button>
            )}
          </Mutation>
        </aside>
        <Query query={GET_DRAFTS}>
          {({ client, loading, data: { drafts = [] } = {} }) => {
            return drafts.map(d => (
              <article key={d.id}>
                <Mutation mutation={DELETE_POST}>
                  {deletePost => (
                    <button onClick={() => deletePost({ variables: d })}>
                      Delete
                    </button>
                  )}
                </Mutation>
                <Mutation mutation={PUBLISH}>
                  {publishDraft => (
                    <button onClick={() => publishDraft({ variables: d })}>
                      Publish
                    </button>
                  )}
                </Mutation>
                <pre>{JSON.stringify(d, null, 2)}</pre>
              </article>
            ));
          }}
        </Query>
      </div>
    );
  }
}

ReactDOM.render(
  <ApolloProvider client={client}>
    <Router>
      <div>
        <Query query={GET_ME}>
          {({ client, loading, data: { me = {} } = {} }) => {
            if (loading) {
              return <div>Loading</div>;
            }
            if (me.id) {
              return (
                <nav>
                  <ul>
                    <li>
                      <NavLink exact activeClassName="selected" to="/">
                        Home
                      </NavLink>
                    </li>
                    <li>
                      <NavLink exact activeClassName="selected" to="/me">
                        Me
                      </NavLink>
                    </li>
                    <li>
                      <NavLink exact activeClassName="selected" to="/logout">
                        Log out
                      </NavLink>
                    </li>
                  </ul>
                </nav>
              );
            }
            return (
              <nav>
                <ul>
                  <li>
                    <NavLink exact activeClassName="selected" to="/">
                      Home
                    </NavLink>
                  </li>
                  <li>
                    <NavLink exact activeClassName="selected" to="/login">
                      Log in
                    </NavLink>
                  </li>
                  <li>
                    <NavLink exact activeClassName="selected" to="/signup">
                      Sign up
                    </NavLink>
                  </li>
                </ul>
              </nav>
            );
          }}
        </Query>
        <Route path="/" exact component={Home} />
        <Route
          path="/me"
          render={() => {
            return (
              <Query query={GET_ME}>
                {({ client, loading, data: { me = {} } = {} }) => {
                  if (loading) {
                    return <div>Loading</div>;
                  }
                  if (me.id) {
                    return <Me />;
                  }
                  return <Redirect to="/login" />;
                }}
              </Query>
            );
          }}
        />
        <Route
          path="/login"
          render={() => {
            return (
              <Query query={GET_ME}>
                {({ client, loading, data: { me = {} } = {} }) => {
                  if (loading) {
                    return <div>Loading</div>;
                  }
                  if (me.id) {
                    return <Redirect to="/me" />;
                  }
                  return <Login />;
                }}
              </Query>
            );
          }}
        />
        <Route
          path="/signup"
          render={() => {
            return (
              <Query query={GET_ME}>
                {({ client, loading, data: { me = {} } = {} }) => {
                  if (loading) {
                    return <div>Loading</div>;
                  }
                  if (me.id) {
                    return <Redirect to="/me" />;
                  }
                  return <Signup />;
                }}
              </Query>
            );
          }}
        />
        <Route
          path="/logout"
          render={() => {
            bearerToken = localStorage.token = null;
            client.resetStore();
            return <Redirect to="/" />;
          }}
        />
      </div>
    </Router>
  </ApolloProvider>,
  document.getElementById("app")
);
