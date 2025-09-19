import models from '../models/index.js';

export const append_account_class = async (args) => {
	let account_rec = await models.AccountClass.create({
		major: args.major,
		middle: args.middle,
		minor: args.minor,
		field: args.field,
		adding: args.adding
	});
}

append_account_class({
	major: '経常損益',
	middle: '営業外費用',
	minor: '開業費償却',
	field: 9,
	adding: 4
});

