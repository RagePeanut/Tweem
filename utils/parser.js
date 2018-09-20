const config = require('../config');

const modifiers = {
    capitalize: str => str.replace(/[A-Za-z0-9]+/g, match => match[0].toUpperCase() + match.substring(1)),
    lowercase: str => str.toLowerCase(),
    uppercase: str => str.toUpperCase()
}

/**
 * Parses a template into a structure
 * @param {string} template The template of the tweet
 * @param {object} values The variables' values
 * @returns {object} The parsed structure
 */
function parse(template, values) {
    const structure = {
        children: [],
        parsed: template,
        raw: template,
        variable: ''
    }
    let i = 1;
    let child;
    do {
        child = template.match(new RegExp('(\\[.+]|{[a-z0-9,]+})::' + i));
        if(child) {
            // Variable
            if(child[1][0] === '{') {
                const [variable, modifier] = child[1].split(/[{}]/)[1].split(',');
                const parsed = processVariable(variable, modifier, values);
                structure.children.push({ children: [], parsed: parsed, raw: child[0], variable: variable });
                structure.parsed = structure.parsed.replace(child[0], parsed);
            // Other
            } else {
                const childStructure = parse(child[1].substring(1, child[1].length - 1), values);
                childStructure.raw = '[' + childStructure.raw + ']::' + i;
                structure.children.push(childStructure);
                // Replacing the child's raw text by a placeholder to avoid parsing text from the child
                structure.parsed = structure.parsed.replace(child[0], '%CHILD' + (i - 1) + '%');
            }
        }
        i++;
    } while(child);
    structure.parsed = structure.parsed.replace(/%CHILD(\d+)%/, (match, index) => structure.children[index].parsed)
                                       .replace(/{([a-z0-9,]+)}/, (match, content) => {
                                           // Replacing non removable variables by their values
                                           const [variable, modifier] = content.split(',');
                                           return processVariable(variable, modifier, values);
                                       })
    return structure;
}

/**
 * Processes a variable based on its value and modifier
 * @param {string} variable The variable to process
 * @param {string} modifier The modifier's name
 * @param {object} values The variables' values
 * @returns {string} The processed variable
 */
function processVariable(variable, modifier, values) {
    if(values.hasOwnProperty(variable)) {
        if(variable === 'title') {
            variable = values[variable];
            // Mentions
            // If set to true, completely removes the mentions in the title (e.g. 'Hello @ragepeanut !' --> 'Hello !')
            if(config.settings.mentions.remove_mentions) variable = variable.replace(/( )?@[a-zA-Z0-9._-]+( )?/g, (match, firstSpace, secondSpace) => firstSpace || secondSpace);
            // If set to true, removes the @ character from mentions (e.g. 'Bye @ragepeanut !' --> 'Bye ragepeanut !')
            else if(config.settings.mentions.remove_mentions_at_char) variable = variable.replace(/@([a-zA-Z0-9._-]+)/g, '$1');
            // If set to true, escapes a mention if it is the first word of the title (e.g. '@ragepeanut isn\'t a real peanut :O' --> '.@ragepeanut isn\'t a real peanut :O')
            else if(config.settings.mentions.escape_starting_mention && variable[0] === '@') variable = '.' + variable;
        } else if(variable === 'tags') {
            let tags = values[variable];
            // If set to true, removes any duplicate tag from the tags array
            if(config.settings.tags.check_for_duplicate) {
                const tmpTags = [];
                tags.forEach(tag => {
                    if(!tmpTags.includes(tag)) tmpTags.push(tag);
                });
                tags = tmpTags;
            }
            // If set to an integer, takes only the X first tags
            if(config.settings.tags.limit) tags = tags.slice(0, config.settings.tags.limit);
            variable = tags.map(tag => '#' + tag).join(' ');
        } else variable = values[variable];
    }
    if(modifiers.hasOwnProperty(modifier)) variable = modifiers[modifier](variable);
    return variable;
}

module.exports = {
    parse: parse
}