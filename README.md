# Shizu Backend Requirements

This folder contains the `requirements.txt` file required for deploying the Shizu backend to a public server such as Render, Railway, or AWS.

## How to Use

1. Navigate to your project root directory.
2. Place the `requirements.txt` file there if it's not already present.
3. Run the following command to install dependencies:

```bash
pip install -r requirements.txt
```

4. For deploying on Render, ensure the following settings:
   - **Start command**: `gunicorn main:app --worker-class eventlet -w 1`
   - **Python version**: Match your local runtime or set in `render.yaml`

Make sure your `.env` file is correctly configured in the environment settings.

You're now ready to deploy!
# Session 8 complete
