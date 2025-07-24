exports.handler = async () => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Hello from the backend! Your functions are working." }),
    };
  };