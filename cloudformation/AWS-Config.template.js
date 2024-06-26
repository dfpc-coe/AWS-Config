import cf from '@openaddresses/cloudfriend';
import Rules from './lib/rules.js';
import Config from './lib/config.js';

export default cf.merge({
    Description: 'Template for @tak-ps/aws-config',
    Parameters: {
        GitSha: {
            Description: 'GitSha that is currently being deployed',
            Type: 'String'
        }
    }
}, Config, Rules);
