exports.handler = async (event, context) => {
    console.error(JSON.stringify(event, null, 2));
    console.error(JSON.stringify(context, null, 2));
};
