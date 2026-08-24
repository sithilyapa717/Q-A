(function () {
  const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'];

  const STANDARD_LABELS = {
    A: 'Antisocial Personality Disorder',
    B: 'Conduct Disorder',
    C: 'Adjustment Disorder',
    D: 'Alcohol Intoxication',
    E: 'No mental disorder is indicated'
  };

  const UNDERLYING_LABELS = {
    A: 'Antisocial Personality Disorder',
    B: 'Conduct Disorder',
    C: 'Adjustment Disorder',
    D: 'Alcohol Intoxication',
    E: 'No underlying mental disorder is indicated'
  };

  const BASE_SYMPTOMS =
    'repeatedly lies to get what she wants, manipulates other people, breaks rules, gets into fights, acts impulsively without considering consequences, and shows little remorse after hurting others.';

  const DIVORCE_CONTEXT =
    'However, these behavioural changes began only three months ago, immediately following her parents\' divorce. Before the divorce, she had no history of significant aggression, theft, cruelty, or persistent rule-breaking.';

  const ALCOHOL_CONTEXT =
    'Further assessment reveals that the aggressive and impulsive episodes occur only when she has consumed a large amount of alcohol. During these episodes, she becomes extremely disinhibited, has difficulty controlling her behaviour, and later remembers very little of what happened. When she is sober, these behaviours disappear.';

  const FUNCTIONING_CONTEXT =
    'She continues attending school, performs well academically, maintains close friendships and has not experienced significant disruption to her everyday functioning.';

  const DISTRESS_CONTEXT =
    'She does not experience persistent psychological distress about these behaviours, and there is no evidence that she meets the diagnostic criteria for a separate mental disorder.';

  const QUESTIONS = [
    {
      index: 1,
      prompt: 'What is the MOST likely diagnosis?',
      labels: STANDARD_LABELS,
      segments: [
        {
          text:
            'A person repeatedly lies to get what they want, manipulates other people, breaks rules, gets into fights, acts impulsively without considering consequences, and shows little remorse after hurting others. These behaviours have been occurring repeatedly over a long period of time.',
          isNew: false
        }
      ]
    },
    {
      index: 2,
      prompt: 'What is the MOST likely diagnosis?',
      labels: STANDARD_LABELS,
      segments: [
        { text: 'A 16-year-old ', isNew: true },
        {
          text:
            BASE_SYMPTOMS +
            ' These behaviours have been occurring repeatedly over a long period of time.',
          isNew: false
        }
      ]
    },
    {
      index: 3,
      prompt: 'What is the MOST likely diagnosis?',
      labels: STANDARD_LABELS,
      segments: [
        { text: 'A 16-year-old ' + BASE_SYMPTOMS + ' ', isNew: false },
        { text: DIVORCE_CONTEXT, isNew: true }
      ]
    },
    {
      index: 4,
      prompt: 'What is the MOST likely explanation?',
      labels: STANDARD_LABELS,
      segments: [
        {
          text: 'A 16-year-old ' + BASE_SYMPTOMS + ' ' + DIVORCE_CONTEXT + ' ',
          isNew: false
        },
        { text: ALCOHOL_CONTEXT, isNew: true }
      ]
    },
    {
      index: 5,
      prompt: 'What is the MOST appropriate conclusion about an underlying mental disorder?',
      labels: UNDERLYING_LABELS,
      segments: [
        {
          text:
            'A 16-year-old ' +
            BASE_SYMPTOMS +
            ' ' +
            DIVORCE_CONTEXT +
            ' ' +
            ALCOHOL_CONTEXT +
            ' ',
          isNew: false
        },
        { text: FUNCTIONING_CONTEXT, isNew: true }
      ]
    },
    {
      index: 6,
      prompt: 'What is the MOST appropriate conclusion?',
      labels: UNDERLYING_LABELS,
      segments: [
        {
          text:
            'A 16-year-old ' +
            BASE_SYMPTOMS +
            ' ' +
            DIVORCE_CONTEXT +
            ' ' +
            ALCOHOL_CONTEXT +
            ' ' +
            FUNCTIONING_CONTEXT +
            ' ',
          isNew: false
        },
        { text: DISTRESS_CONTEXT, isNew: true }
      ]
    }
  ];

  function getQuestion(index) {
    return QUESTIONS.find((q) => q.index === index) || null;
  }

  function getQuestionCount() {
    return QUESTIONS.length;
  }

  function getOptionKeys() {
    return OPTION_KEYS.slice();
  }

  function getOptionLabel(question, key) {
    if (!question || !question.labels) {
      return STANDARD_LABELS[key] || key;
    }
    return question.labels[key] || key;
  }

  function toBroadcastPayload(question) {
    return {
      index: question.index,
      prompt: question.prompt,
      segments: question.segments,
      options: OPTION_KEYS.slice(),
      labels: question.labels
    };
  }

  window.DiagnoseQuestions = {
    QUESTIONS,
    getQuestion,
    getQuestionCount,
    getOptionKeys,
    getOptionLabel,
    toBroadcastPayload
  };
})();
