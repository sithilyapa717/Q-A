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
      hint: {
        title: 'Antisocial Personality Disorder (ASPD)',
        parts: [
          {
            type: 'text',
            value:
              "A long-term pattern of behaviours involving disregard for other people's rights, rules, and social responsibilities."
          },
          { type: 'label', value: 'Helpful clues:' },
          {
            type: 'list',
            items: [
              'Deceitfulness or repeated lying',
              'Manipulation',
              'Aggressive or reckless behaviour',
              'Repeated violation of rules',
              'Limited concern for the consequences to others',
              'Usually considered as a persistent pattern rather than a few isolated incidents'
            ]
          }
        ]
      },
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
      hint: {
        title: 'Conduct Disorder',
        notice: {
          title: '⚠️ Important age consideration',
          body: 'Antisocial Personality Disorder cannot be diagnosed before age 18.'
        },
        parts: [
          {
            type: 'text',
            value:
              'A disorder involving a persistent pattern of serious behavioural problems in children or adolescents.'
          },
          { type: 'label', value: 'Helpful clues:' },
          {
            type: 'list',
            items: [
              'Aggression toward people or animals',
              'Serious rule-breaking',
              'Destruction of property',
              'Deceitfulness or theft',
              "Repeatedly violating important rules or others' rights",
              'Occurs during childhood or adolescence'
            ]
          }
        ]
      },
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
      hint: {
        title: 'Adjustment Disorder',
        parts: [
          {
            type: 'text',
            value:
              'A psychological reaction that develops in response to an identifiable stressful or life-changing event.'
          },
          { type: 'label', value: 'Helpful clues:' },
          {
            type: 'list',
            items: [
              'Symptoms occur after a significant stressor',
              "The symptoms represent a change from the person's previous functioning",
              'Emotional or behavioural changes can occur',
              'The timing between the stressor and symptoms matters',
              "The person's response is greater than what would normally be expected or causes significant problems"
            ]
          }
        ]
      },
      segments: [
        { text: 'A 16-year-old ' + BASE_SYMPTOMS + ' ', isNew: false },
        { text: DIVORCE_CONTEXT, isNew: true }
      ]
    },
    {
      index: 4,
      prompt: 'What is the MOST likely explanation?',
      labels: STANDARD_LABELS,
      hint: {
        title: 'Alcohol Intoxication',
        parts: [
          {
            type: 'text',
            value:
              'A temporary state that occurs when alcohol affects the brain and behaviour.'
          },
          { type: 'label', value: 'Helpful clues:' },
          { type: 'label', value: 'It can involve:' },
          {
            type: 'list',
            items: [
              'Impaired judgment',
              'Poor decision-making',
              'Reduced self-control',
              'Impulsivity',
              'Aggression or unusual behaviour',
              'Confusion or memory problems',
              'Changes that occur while alcohol is affecting the person'
            ]
          }
        ]
      },
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
      hint: {
        title: 'Severity & Impairment',
        parts: [
          { type: 'heading', value: 'Severity' },
          { type: 'text', value: 'How intense or serious are the symptoms?' },
          { type: 'heading', value: 'Impairment' },
          {
            type: 'text',
            value:
              "How much are the symptoms interfering with the person's everyday life?"
          }
        ]
      },
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
      hint: {
        title: '🧠 DISTRESS',
        parts: [
          {
            type: 'text',
            value:
              'Does the person experience significant psychological suffering because of their symptoms?'
          },
          { type: 'label', value: 'Helpful questions:' },
          {
            type: 'list',
            items: [
              "Are they suffering because of what's happening?",
              'Do they feel overwhelmed or unable to cope?',
              'Is the behaviour causing significant problems?',
              'Is there significant interference with everyday functioning?'
            ]
          }
        ]
      },
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

  function getHint(index) {
    return getQuestion(index)?.hint || null;
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
    getHint,
    toBroadcastPayload
  };
})();
