"use strict";

/* eslint-disable no-unused-vars */
// Public node modules.
const AWS = require('aws-sdk');
const URI = require('urijs');

class FileLocationConverter {
    constructor(config) {
        this.config = config;
    }

    getKey(file) {
        const path = file.path ? `${file.path}/` : '';
        const filename = `${path}${file.hash}${file.ext}`;
        if (!this.config.directory) return filename;
        return `${this.config.directory}/${filename}`;
    }

    getUrl(data) {
        if (!this.config.cdn) return data.Location;
        var parts = {};
        URI.parseHost(this.config.cdn, parts);
        parts.protocol = "https"; // Force https
        parts.path = data.Key;
        return URI.build(parts);
    }
}

module.exports = {
    init(config) {
        const endpoint = new AWS.Endpoint(config.endpoint);
        const converter = new FileLocationConverter(config);

        const S3 = new AWS.S3({
            apiVersion: '2006-03-01',
            endpoint: endpoint,
            accessKeyId: config.key,
            secretAccessKey: config.secret,
            params: {
                ACL: 'public-read', Bucket: config.space, CacheControl: 'public, max-age=31536000, immutable'
            },
        });

        const upload = (file, customParams = {}) => new Promise((resolve, reject) => {
            // upload file on DO (technically S3 bucket)
            S3.upload({
                Key: converter.getKey(file),
                Body: file.stream || Buffer.from(file.buffer, 'binary'),
                ACL: 'public-read',
                ContentType: file.mime, ...customParams,
            }, (err, data) => {
                if (err) {
                    return reject(err);
                }

                // set the bucket file url
                file.url = converter.getUrl(data);

                resolve();
            });
        });

        return {
            uploadStream(file, customParams = {}) {
                return upload(file, customParams);
            }, upload(file, customParams = {}) {
                return upload(file, customParams);
            }, delete(file, customParams = {}) {
                return new Promise((resolve, reject) => {
                    // delete file on S3 bucket
                    const path = file.path ? `${file.path}/` : '';
                    S3.deleteObject({
                        Bucket: config.bucket, Key: converter.getKey(file), ...customParams,
                    }, (err, data) => {
                        if (err) {
                            return reject(err);
                        }

                        resolve();
                    });
                });
            },
        };
    },
};
