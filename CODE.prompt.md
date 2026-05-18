Organize the code into the following folder structure:

```
frontend/
    ~dist/
        # compiled
    src/
        components/
            root.tsx
            editor.tsx
            ...
        index.html
    package.json
    tsconfig.json
    .prettierrc.json
    .gitignore
    vite.config.js
    yarn.lock
backend/
    src/
        db/
            create.py # set up DB if not exists and provide connection object
            access.py # access DB by lookup etc given a connection object

        agents/
            create.py # set up API endpoint
            edit.py # send an edit/correction request
        setup_db.py
        access_db.py

        main.py

    pyproject.toml
    poetry.toml
    .gitignore


.editorconfig
.gitignore
.gitattributes

```
