const { settings } = require('../config');

const modifiers = {
    capitalize: str => str.replace(/[A-Za-z0-9]+/g, match => match[0].toUpperCase() + match.substring(1)),
    lowercase: str => str.toLowerCase(),
    uppercase: str => str.toUpperCase()
}

/**
 * Parses a template into a structure
 * @param {string} template The template of the message
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
 * Removes or modifies the least important element from a structure
 * @param {object} structure The structure of the part of a message
 * @returns {object} The passed structure with one modified element
 */
function removeLeastImportant(structure) {
    if(structure.children.length > 0) {
        const leastImportantChild = structure.children[structure.children.length - 1];
        const originalLeastImportantChildParsed = leastImportantChild.parsed;
        if(leastImportantChild.children.length > 0) {
            leastImportantChild = removeLeastImportant(leastImportantChild);
            structure.parsed = structure.parsed.replace(originalLeastImportantChildParsed, leastImportantChild.parsed);
        } else {
            switch(leastImportantChild.variable) {
                case 'tags':
                    // If set to true, removes tags by order of importance (last tag removed first)
                    if(settings.tags.remove_tags_by_order) leastImportantChild.parsed = leastImportantChild.parsed.replace(/ ?#[A-Za-z\d-]+$/, '');
                    // If set to true, removes tags by order of importance (first tag removed first)
                    else if(settings.tags.remove_tags_by_order_opposite) leastImportantChild.parsed = leastImportantChild.parsed.replace(/^#[A-Za-z\d-]+ ?/, '');
                    // If set to true, removes tags by length (smallest removed first)
                    else if(settings.tags.remove_tags_by_length) {
                        const tags = leastImportantChild.parsed.split(' ');
                        const smallestTag = tags.reduce((a, b) => a.length < b.length ? a : b);
                        leastImportantChild.parsed = tags.filter(tag => tag !== smallestTag).join(' ');
                    // If set to true, removes tags by length (longest removed first)
                    } else if(settings.tags.remove_tags_by_length_opposite) {
                        const tags = leastImportantChild.parsed.split(' ');
                        const longestTag = tags.reduce((a, b) => a.length > b.length ? a : b);
                        leastImportantChild.parsed = tags.filter(tag => tag !== longestTag).join(' ');
                    } else leastImportantChild.parsed = '';
                    break;
                case 'title':
                    leastImportantChild.parsed = leastImportantChild.parsed.replace(/.(.{3})$/, (match, lastChars) => {
                        if(lastChars === '...') return '...';
                        else return match[0] + '...';
                    });
                    if(leastImportantChild.parsed === '...') leastImportantChild.parsed = '';
                    break;
                default:
                    leastImportantChild.parsed = '';
                    break;
            }
            structure.parsed = structure.parsed.replace(originalLeastImportantChildParsed, leastImportantChild.parsed).replace(/ +/, ' ');
            if(leastImportantChild.parsed === '') {
                structure.raw = structure.raw.replace(leastImportantChild.raw, '').replace(/ +/, ' ');
                structure.children.pop();
            }
        }
    }
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
            if(settings.mentions.remove_mentions) variable = variable.replace(/( )?@[a-zA-Z0-9._-]+( )?/g, (match, firstSpace, secondSpace) => firstSpace || secondSpace);
            // If set to true, removes the @ character from mentions (e.g. 'Bye @ragepeanut !' --> 'Bye ragepeanut !')
            else if(settings.mentions.remove_mentions_at_char) variable = variable.replace(/@([a-zA-Z0-9._-]+)/g, '$1');
            // If set to true, escapes a mention if it is the first word of the title (e.g. '@ragepeanut isn\'t a real peanut :O' --> '.@ragepeanut isn\'t a real peanut :O')
            else if(settings.mentions.escape_starting_mention && variable[0] === '@') variable = '.' + variable;
        } else if(variable === 'tags') {
            let tags = values[variable];
            // Tag propagation
            const propagatedTags = [];
            tags.forEach(tag => {
                if(settings.tags.propagate[tag]) {
                    if(typeof settings.tags.propagate[tag] === 'string') settings.tags.propagate[tag] = [settings.tags.propagate[tag]];
                    settings.tags.propagate[tag].forEach(tag => {
                        if(!propagatedTags.includes(tag)) propagatedTags.push(tag);
                    });
                }
            });
            propagatedTags.forEach(tag => {
                if(!tags.includes(tag)) tags.push(tag);
            });
            // Filtering out unwanted tags and changing unsupported tags
            tags = tags.filter(tag => !settings.tags.filter_out.includes(tag))
                       .map(tag => tag.replace('-', '_'));
            // If set to true, removes all the tags automatically generated by the post's app
            if(settings.tags.remove_app_tags && values.app) {
                const appTags = {
                    bescouted: /^bescouted$/,
                    blockdeals: /^blockdeals(-[a-z]+)?$/,
                    busy: /^busy$/,
                    coogger: /^coogger$/,
                    dlike: /^dlike(-[A-Za-z]+)?$/,
                    dmania: /^dmania$/,
                    dpoll: /^dpoll$/,
                    dsound: /^dsound$/,
                    dtube: /^dtube$/,
                    esteem: /^esteem$/,
                    fundition: /^((my|up)fundition|fundition-[a-z\d])+$/,
                    hede: /^hede-io$/,
                    knacksteem: /^knacksteem$/,
                    'memeit.lol': /^memeitlol$/,
                    mTasks: /^mtasks$/,
                    parley: /^parley(-[a-z]+)?$/,
                    partiko: /^partiko$/,
                    share2steem: /^share2steem$/,
                    steemgig: /^steemgigs?$/,
                    steemhunt: /^steemhunt$/,
                    steepshot: /^steepshot$/,
                    strimi: /^strim(-[a-z]+)?$/,
                    ulogs: /^ulog(-[a-z-]+)?$/,
                    utopian: /^utopian-io$/,
                    'vimm.tv': /^vimmtv(broadcast)?$/,
                    zappl: /^zappl$/
                }
                // Filtering out app tags for the post's posting app
                if(appTags[values.app]) tags = tags.filter(tag => !appTags[values.app].test(tag));
            }
            // If set to true, removes any duplicate tag from the tags array
            if(settings.tags.check_for_duplicate) {
                const tmpTags = [];
                tags.forEach(tag => {
                    if(!tmpTags.includes(tag)) tmpTags.push(tag);
                });
                tags = tmpTags;
            }
            // If set to an integer, takes only the X first tags
            if(settings.tags.limit) tags = tags.slice(0, settings.tags.limit);
            variable = tags.map(tag => '#' + tag).join(' ');
        } else variable = values[variable];
    }
    if(modifiers.hasOwnProperty(modifier)) variable = modifiers[modifier](variable);
    return variable;
}

module.exports = {
    parse: parse,
    removeLeastImportant
}