'use strict';

const React = require('react');
const { LoremIpsum } = require("lorem-ipsum");

class Paragraph extends React.Component {
  #lorem;
  constructor(props) {
    super(props);
    this.#lorem = new LoremIpsum({
      sentencesPerParagraph: {
        max: 8,
        min: 4
      },
      wordsPerSentence: {
        max:16,
        min: 4
      }
    });
  }

  render() {
    return React.createElement('div', null, this.#lorem.generateParagraphs(1));
  }
}

class Lorem extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const children = [];
    for (let n = 0; n < Math.floor(Math.random() * 50); n++)
      children.push(React.createElement(Paragraph, { key: n }));
    return React.createElement('div', null, children);
  }
}

module.exports = Lorem;
